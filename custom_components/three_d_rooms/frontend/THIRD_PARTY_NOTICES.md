# Third-party notices

3D Rooms builds on [Wes Bos’s 3D Model Anything](https://github.com/wesbos/3d-model-anything). The original MIT copyright notice is retained in `LICENSE` and `rooms-app/LICENSE`.

The upstream license also includes this separate asset notice:

> Files under data/ and docs/images/thumb-1.png are excluded; see ASSETS-LICENSE.md.

Those upstream asset paths are not distributed in this repository. Their exclusion from the upstream MIT grant remains in effect; see the upstream [ASSETS-LICENSE.md](https://github.com/wesbos/3d-model-anything/blob/main/ASSETS-LICENSE.md) for their terms. The MIT license in this repository does not grant rights to those upstream assets or to users’ uploaded room models, scans, photographs or textures.

## Libraries bundled in the integration's frontend

The compiled manager and dashboard card in `custom_components/three_d_rooms/frontend/` include:

- [three.js](https://github.com/mrdoob/three.js) — MIT License, Copyright © 2010–2026 three.js authors. Includes its meshopt decoder and KTX2 loader.
- [glTF Transform](https://github.com/donmccurdy/glTF-Transform) (`@gltf-transform/core`, `extensions`, `functions`) — MIT License, Copyright © Don McCurdy. Used only by the manager's room optimizer.
- [meshoptimizer](https://github.com/zeux/meshoptimizer) — MIT License, Copyright © Arseny Kapoulkine. Used by the manager's room optimizer.
- [ktx2-encoder](https://github.com/gz65555/ktx2-encoder) — MIT License, Copyright © Hu Song. Used only by the manager's room optimizer.
- [home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket) — Apache License 2.0, © its authors. Used by the full-screen view page (`three-d-rooms-standalone.js`) to sign in and connect to Home Assistant; the library ships no NOTICE file. License text: https://www.apache.org/licenses/LICENSE-2.0
- [Basis Universal](https://github.com/BinomialLLC/basis_universal) — Apache License 2.0. The encoder (`basis_encoder.wasm`, via ktx2-encoder) and the transcoder (`basis/basis_transcoder.*`, via three.js) are precompiled builds of Basis Universal. Its attribution notice, reproduced as required by Apache-2.0 §4(d):

```
Basis Universal™ Supercompressed GPU Texture Compression Library

Copyright © 2016–2026 Binomial LLC.
All rights reserved except as granted under the Apache 2.0 license
(https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE).
"Basis Universal" is a trademark of Binomial LLC.

The documents in the Basis Universal wiki, and the Basis Universal library,
example, and tool source code, fall under the Apache 2.0 license, unless
otherwise explicitly indicated.

Redistributions or derivative works must include a readable copy of the
attribution notices from this NOTICE file (see Apache License 2.0 §4(d)).
```

## Material Design Icons (`@mdi/js` 7.4.47)

The model manager's icon picker bundles path data from Material Design Icons by
the Pictogrammers icon group (https://pictogrammers.com/library/mdi/). The full
set loads only when the picker is opened. The icons are distributed under the
Pictogrammers Free License: icons under the Apache License 2.0, package code
under the MIT License. Icon names, aliases and tags for search are generated
from `@mdi/svg` 7.4.47 metadata under the same terms.

```
Pictogrammers Free License
This icon collection is released as free, open source, and GPL friendly by
the Pictogrammers icon group. You may use it for commercial projects, open
source projects, or anything really.
Icons: Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
Code: MIT (https://opensource.org/licenses/MIT)
```
