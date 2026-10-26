# Native Home Assistant verification · 0.16.1

Tested in the managed local Home Assistant Core 2026.10.2 instance, using the pinned official image and persistent config. The 0.16.0 release integration ZIP was tested first, then the icon/loading fix and 0.16.1 package. No production Home Assistant or physical devices were contacted.

- All eight native Python tests pass, including numeric bounds/units/caller context and all four button/script/scene service domains.
- The private office ZIP is about 53 MB compressed and 75.2 MB unpacked, with 1128 nodes, 1025 meshes, 330 materials and 47 images.
- Native API baseline: upload 0.873 s, replacement 0.639 s, first authenticated compressed scene retrieval 1.681 s on this workstation.
- Before the fix, native manager icons raised repeated adoptedStyleSheets cross-document errors. After resolving HA icons in the parent document and copying only SVG data, all four native macro icons render and browser error collection is empty.
- The native manager has one desk card and one settings box with all six entity mappings. Local input-number, template-cover and input-button helpers verify 73/100/130 cm, Up/Stop/Down and four actual button presses. The helpers control no physical devices.
- After the fix: browser model readiness about 1.1 s with cached shaders; visible replacement server response 0.832 s, full replacement workflow 2.644 s. The button phases are Uploading model…, Preparing 3D view…, Replace model. Timings are local measurements, not promises for other hardware or networks.
- Frontend regression suite: 78 tests pass. Formatting and production manager/card builds pass. Private room assets, runtime state and credentials are excluded from release assets.

Replacing a model deliberately retains its existing room name, area, matching mappings and saved views; it updates the underlying geometry. Re-exporting the office is unnecessary for this integration-only icon/loading fix when the desk-enabled model ZIP is already available.
