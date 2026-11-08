"""Portable room placement and derived house/floor views; no scene duplication."""
from .light_groups import position_group_markers
from copy import deepcopy
import json
import math
import re


def _id(value, maximum=80):
    return isinstance(value, str) and len(value) <= maximum and bool(re.fullmatch(r"[a-z0-9][a-z0-9_-]*", value)) and value not in ("constructor", "prototype")


def _number(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def validate_placement(value):
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or not _id(value.get("houseId"), 48) or not _id(value.get("roomId")) or not isinstance(value.get("houseName"), str) or not value["houseName"].strip() or len(value["houseName"]) > 160:
        raise ValueError("Invalid house identity.")
    t = value.get("transform")
    if not isinstance(t, list) or len(t) != 16 or not all(_number(n) for n in t) or abs(t[3])+abs(t[7])+abs(t[11]) > .001 or abs(t[15]-1) > .001:
        raise ValueError("Invalid room placement.")
    axes = [t[:3], t[4:7], t[8:11]]
    def dot(a, b):
        return sum(x*y for x, y in zip(a, b))
    if any(abs(dot(a,a)-1) > .01 for a in axes) or abs(dot(axes[0],axes[1]))+abs(dot(axes[1],axes[2]))+abs(dot(axes[0],axes[2])) > .01 or abs(t[4])+abs(t[6])+abs(t[5]-1) > .01 or t[0]*t[10]-t[2]*t[8] < .99:
        raise ValueError("Room placements must preserve metres and vertical orientation.")
    if not isinstance(value.get("floors"), list) or len(value["floors"]) > 30:
        raise ValueError("Provide up to 30 floors.")
    floors, seen = [], set()
    for f in value["floors"]:
        if not isinstance(f, dict) or not _id(f.get("id"),20) or f["id"] in seen or not isinstance(f.get("name"),str) or not f["name"].strip() or len(f["name"]) > 100 or not _number(f.get("minY")) or not _number(f.get("maxY")) or f["minY"] >= f["maxY"] or f["maxY"]-f["minY"] > 30 or abs(f["minY"]) > 1000:
            raise ValueError("Invalid floor height range.")
        if "haFloorId" in f and (not isinstance(f["haFloorId"],str) or not f["haFloorId"] or len(f["haFloorId"])>128):
            raise ValueError("Invalid Home Assistant floor ID.")
        seen.add(f["id"])
        floors.append({"id":f["id"],"name":f["name"].strip(),"minY":f["minY"],"maxY":f["maxY"],**({"haFloorId":f["haFloorId"]} if f.get("haFloorId") else {})})
    ids = value.get("floorIds")
    if not isinstance(ids,list) or len(ids)>30 or not all(isinstance(i,str) and i in seen for i in ids) or len(set(ids)) != len(ids):
        raise ValueError("Choose existing floors for this room.")
    return {"schemaVersion":1,"houseId":value["houseId"],"houseName":value["houseName"].strip(),"roomId":value["roomId"],"transform":list(t),"floors":floors,"floorIds":list(ids)}


def house_key(value):
    h = 14695981039346656037
    for c in value.encode():
        h = ((h ^ c) * 1099511628211) & ((1 << 64)-1)
    return f"{h:016x}"


def placed_point(p,t):
    return [t[i]*p[0]+t[4+i]*p[1]+t[8+i]*p[2]+t[12+i] for i in range(3)]


def house_models(models):
    groups = {}
    for m in models:
        if m.get("housePlacement") and not m.get("members"):
            p = validate_placement(m["housePlacement"])
            groups.setdefault(p["houseId"],[]).append(m)
    result = []
    for house_id, rooms in groups.items():
        reference = sorted(rooms,key=lambda m:m.get("importedAt",""),reverse=True)[0]["housePlacement"]
        for floor in [None,*reference["floors"]]:
            included = [m for m in rooms if not floor or floor["id"] in m["housePlacement"]["floorIds"]]
            if not included:
                continue
            model = {"schemaVersion":1,"id":f"h-{house_id}"+(f'--{floor["id"]}' if floor else ""),"title":reference["houseName"]+(f' · {floor["name"]}' if floor else ""),"units":"meters","up":"Y","controls":[],"devices":[],"bindings":{},"ambient":.45,"members":[],"houseView":True,"houseId":house_id,"houseFloor":floor,"deviceSettings":{}}
            for m in included:
                t = m["housePlacement"]["transform"]
                def key(c):
                    return "c-"+house_key(m["id"]+"/"+c)
                def node(n):
                    return "n-"+house_key(m["id"]+"/"+n)
                controls = []
                for c in m["controls"]:
                    p = placed_point(c["position"],t)
                    if floor and not floor["minY"] <= p[1] < floor["maxY"]:
                        continue
                    controls.append({**deepcopy(c),"id":key(c["id"]),"label":m["title"]+" · "+c["label"],"position":p,**({"markerPosition":placed_point(c["markerPosition"],t)} if "markerPosition" in c else {}),**({"lightGroup":key(c["lightGroup"]),"lightGroupLabel":m["title"]+" · "+c["lightGroupLabel"]} if c.get("lightGroup") else {}),"nodeIds":[node(n) for n in c.get("nodeIds",[])],**({"group":key(c["group"])} if c.get("group") else {}),"sourceModel":m["id"],"sourceControl":c["id"]})
                position_group_markers(controls)
                model["controls"].extend(controls)
                visible = {c["id"] for c in controls}
                for c in controls:
                    if m["bindings"].get(c["sourceControl"]):
                        model["bindings"][c["id"]] = m["bindings"][c["sourceControl"]]
                for d in m.get("devices",[]):
                    if key(d["height"]) not in visible:
                        continue
                    device = {**deepcopy(d),"id":key(d["id"]),"height":key(d["height"]),"macros":[key(c) for c in d.get("macros",[])]}
                    if d.get("motion"):
                        device["motion"] = key(d["motion"])
                    model["devices"].append(device)
                    settings = m.get("deviceSettings",{}).get(d["id"])
                    if settings:
                        model["deviceSettings"][device["id"]] = {"macroNames":{key(k):v for k,v in settings.get("macroNames",{}).items()}}
                daylight = m.get("daylight")
                if daylight:
                    # Room windows join one house-wide daylight rig; mode follows the first daylight room.
                    target = model.setdefault("daylight",{"mode":daylight["mode"],"entity":daylight["entity"],"windows":[]})
                    for w in daylight.get("windows",[]):
                        p = placed_point(w["position"],t)
                        if floor and not floor["minY"] <= p[1] < floor["maxY"]:
                            continue
                        inward = [t[i]*w["inward"][0]+t[4+i]*w["inward"][1]+t[8+i]*w["inward"][2] for i in range(3)]
                        target["windows"].append({**deepcopy(w),"id":"w-"+house_key(m["id"]+"/"+w["id"]),"nodeId":node(w["nodeId"]),"position":p,"inward":inward,**({"coverId":key(w["coverId"])} if w.get("coverId") else {}),"sourceModel":m["id"]})
                model["members"].append({"model":m["id"],"appearance":deepcopy(m.get("appearance",[])),"transform":t,"sceneRevision":m.get("sceneRevision"),"controlIds":{c["id"]:key(c["id"]) for c in m["controls"]},"nodeIds":{n:node(n) for c in m["controls"] for n in c.get("nodeIds",[])}})
            if model.get("daylight") and not model["daylight"]["windows"]:
                del model["daylight"]
            model["sceneRevision"] = house_key(json.dumps(model["members"],sort_keys=True)+json.dumps(floor,sort_keys=True))
            result.append(model)
    return result
