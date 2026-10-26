#!/usr/bin/env python3
"""Validate a private 3D Rooms ZIP using its target integration and shade protocol."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import struct
import tempfile
import zipfile


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_shade(root, nodes, control):
    label = control['id']
    data = root.get('extras', {}).get('rollerShade')
    require(isinstance(data, dict), f'{label}: no supported rollerShade adapter; inspect target motion support')
    top, height = data.get('top'), data.get('height')
    require(finite(top) and finite(height) and height > 0, f'{label}: invalid top/height')
    default = control.get('defaultPosition', 0)
    require(data.get('defaultPosition') == default, f'{label}: saved opening differs between manifest and geometry')
    children = root.get('children', [])
    require(bool(children), f'{label}: no moving parts')
    intervals, rails = [], 0
    bottom = top - height
    for index in children:
        require(isinstance(index, int) and not isinstance(index, bool) and 0 <= index < len(nodes), f'{label}: invalid child node')
        part = nodes[index]
        d = part.get('extras', {}).get('rollerShadePart')
        require(isinstance(d, dict) and 'mesh' in part and not part.get('children'), f'{label}: moving meshes must be direct children with rest metadata')
        center, size = d.get('center'), d.get('height')
        require(finite(center) and finite(size) and size > 0, f'{label}: invalid part center/height')
        if 'matrix' in part:
            matrix = part['matrix']
            require(isinstance(matrix, list) and len(matrix) == 16 and all(finite(v) for v in matrix), f'{label}: invalid part matrix')
            require(all(abs(v - (1 if i in (0, 5, 10, 15) else 0)) < 1e-6 for i, v in enumerate(matrix) if i not in (12, 13, 14)), f'{label}: parts must be exported at rest with unit scale and no rotation')
            y = matrix[13]
        else:
            translation = part.get('translation', [0, 0, 0])
            require(isinstance(translation, list) and len(translation) == 3 and all(finite(v) for v in translation), f'{label}: invalid translation')
            y = translation[1]
            require(part.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1], f'{label}: unsupported part rotation')
            scale = part.get('scale', [1, 1, 1])
            require(isinstance(scale, list) and len(scale) == 3 and all(finite(v) and abs(v - 1) < 1e-6 for v in scale), f'{label}: export all parts at rest with unit scale')
        require(abs(y - center) < 1e-6, f'{label}: part is exported open; restore closed geometry before serializing')
        require(bottom - 1e-6 <= center - size / 2 and center + size / 2 <= top + 1e-6, f'{label}: part extends outside its housing')
        if d.get('rail') is True:
            rails += 1
        else:
            intervals.append((center - size / 2, center + size / 2))
    require(rails == 1 and bool(intervals), f'{label}: need slats/fabric and one bottom rail')
    tolerance, end = max(.003, height * .003), bottom
    for lo, hi in sorted(intervals):
        require(lo - end <= tolerance, f'{label}: missing closed-state material; export may have omitted hidden slats')
        end = max(end, hi)
    require(top - end <= tolerance, f'{label}: incomplete closed-state material')
    return len(children)


def validate(package, integration_root):
    module_path = integration_root / 'custom_components/three_d_rooms/models.py'
    require(module_path.is_file(), f'Cannot find target validator: {module_path}')
    spec = importlib.util.spec_from_file_location('target_rooms_models', module_path)
    models = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(models)
    require(package.stat().st_size <= models.MAX_UPLOAD, 'ZIP exceeds target upload limit')
    with tempfile.TemporaryDirectory(prefix='ha-room-check-') as directory:
        destination = Path(directory)
        manifest, bindings = models.extract_package(package.read_bytes(), destination)
        raw_manifest = json.loads((destination / 'manifest.json').read_text())
        if 'daylight' in raw_manifest:
            require('daylight' in manifest, 'Target integration does not preserve daylight metadata; update target support before importing')
        glb = (destination / 'scene.glb').read_bytes()
        document = json.loads(glb[20:20 + struct.unpack_from('<I', glb, 12)[0]])
        nodes = document.get('nodes', [])
        tagged = {}
        for node in nodes:
            control_id = node.get('extras', {}).get('controlId')
            if control_id is not None:
                require(isinstance(control_id, str), 'Scene controlId must be a string')
                require(control_id not in tagged, f'Duplicate scene controlId: {control_id}')
                tagged[control_id] = node
        daylight_windows = manifest.get('daylight', {}).get('windows', [])
        window_nodes = {}
        for node in nodes:
            extras = node.get('extras', {})
            require(not extras.get('daylightRuntime'), 'Do not export generated daylight lights/sky; the target rebuilds them')
            if 'daylightWindowId' in extras:
                key = extras['daylightWindowId']
                require(isinstance(key, str) and key not in window_nodes, 'Daylight scene IDs must be unique strings')
                window_nodes[key] = node
        for window in daylight_windows:
            require(window['nodeId'] in window_nodes and 'mesh' in window_nodes[window['nodeId']], 'Daylight node must identify its preserved glass/aperture mesh')
        controls = []
        for control in manifest['controls']:
            parts = 0
            if control['type'] == 'cover':
                for node_id in control['nodeIds']:
                    parts += check_shade(tagged[node_id], nodes, control)
            controls.append({'id': control['id'], 'type': control['type'], 'nodes': control.get('nodeIds', []), **({'movingParts': parts} if parts else {})})
        return {'valid': True, 'model': manifest['id'], 'controls': controls, 'bindingCount': len(bindings), 'daylightWindows': len(daylight_windows),
                'limits': 'Schema, roller-shade rest geometry and daylight bindings only; verify appearance, motion and HA behavior separately.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--integration-root', type=Path, required=True, help='Trusted local ha-3d-rooms checkout matching the target deployment')
    args = parser.parse_args()
    try:
        result = validate(args.package, args.integration_root)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, struct.error, zipfile.BadZipFile) as error:
        print(json.dumps({'valid': False, 'error': str(error)}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
