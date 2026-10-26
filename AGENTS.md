# Working on 3D Rooms and its HACS releases

This guide applies to the `ha-3d-rooms` repository. Follow the user's task and existing session authorization; reading this file alone is not a request to publish a release.

## Product and package layout

- Repository: `https://github.com/astritzeqiri/ha-3d-rooms`; normal release branch: `main`.
- Ship **one HACS Integration**, domain `three_d_rooms`, with its sidebar manager and dashboard card included. Do not change HACS back to type Dashboard or require a second frontend installation.
- The installable package is `custom_components/three_d_rooms/`. Everything required at runtime must be inside it, including the compiled frontend. HACS users do not run Node or build assets.
- `custom_components/three_d_rooms/{__init__,config_flow,api,models}.py`: setup, configuration, authenticated APIs, persistent models/mappings/components, ZIP validation and storage.
- `rooms-app/web/`: editable manager UI, saved-component UI and Three.js renderer. `rooms-app/dashboard/`: editable card, native sidebar wrapper and HA transport. `rooms-app/shared/`: shared component/camera/light/cache behavior.
- `custom_components/three_d_rooms/frontend/`: **generated** manager and card. Do not edit these bundles directly.
- Root `dist/ha-3d-rooms.js`: generated compatibility card bundle; it is not the primary HACS integration package.
- `rooms-app/server/`, `config.yaml`, Dockerfile and `repository.yaml`: retained legacy add-on/development/migration support. The new integration does not depend on Supervisor, Ingress, or a running add-on.
- `model-exports/`: local upload-ready room ZIPs. Private scans, GLBs, photos, entity mappings, runtime catalogs and credentials must stay outside Git and public release assets. Keep existing ignore rules.

The integration auto-loads `three-d-rooms-card.js?v=VERSION` through Home Assistant. `const.py`'s application version is therefore also the frontend cache-busting version. Users should not need a separate dashboard resource entry.

## Before making changes

1. Work from this repository, not the sibling original viewer. Read `README.md`, `VALIDATION.md`, relevant source and tests.
2. Inspect `git status --short`, branch/remotes, recent commits, and current release tags. Do not assume the next version from an old chat message.
3. Preserve unrelated or concurrent work. Do not reset, clean, overwrite, stage or publish someone else's edits. If necessary, use an isolated checkout, make the focused change against the correct base, and build its release assets there. Recheck the branch and index before committing.
4. Implement in source, then rebuild. A working localhost preview alone does not prove that the HACS package or native HA authentication works.
5. Keep model/control IDs, existing uploads, entity mappings, saved components and storage compatible. If a change needs a storage migration, implement and verify it explicitly. A normal upgrade must not require re-uploading rooms.

## Implementing and checking a change

Run Node commands in **`rooms-app/`**. Run Python commands from the **repository root**. Do not run the relative-path build/release tools from the wrong directory.

From `rooms-app/`:

```sh
npm ci
npm run format
npm test
npm run format:check
npm run build
```

Use `npm ci` when dependencies need installing; do not reinstall an unchanged, working dependency tree unnecessarily. Build after the final source and version edits. `npm run build`:

1. Builds the manager into ignored `rooms-app/dist/`.
2. Builds the standalone card.
3. Runs `tools/build-card.mjs`, updating root `dist/ha-3d-rooms.js` and replacing `custom_components/three_d_rooms/frontend/` with the current manager assets and bundled card.

Commit the generated integration files, including removed old hashed assets, alongside their source. Changes to `tools/build-card.mjs` must preserve a self-contained integration package. The known Three.js chunk-size advisory is not a failed build; do not change its rendering quality merely to silence it.

From the repository root:

```sh
python3 -m unittest discover -s integration-tests -v
git diff --check
```

`test_native.py` skips without Home Assistant installed. Report that honestly; a skip is not native-runtime verification. Run the native tests inside an isolated official Home Assistant runtime when backend/authentication/service behavior changes. If Ruff is available, run its format/check tools on the Python integration and tests; do not assume a formatter under a previous chat's `/tmp` directory still exists.

Use meaningful checks appropriate to the change. Documentation-only work does not need a runtime rebuild, version bump or release unless the user requests one.

### Native Home Assistant verification: local setup

Use a disposable **Home Assistant Core container with demo devices** to exercise the real integration and frontend. This is the local setup used on this workstation, separate from the user's production HA OS/Proxmox VM. It does not require running the legacy add-on or connecting physical lights.

| Item | Local setup |
| --- | --- |
| HA URL | `http://127.0.0.1:18123` (container port 8123) |
| Manager | `http://127.0.0.1:18123/three_d_rooms` |
| Test dashboard | `http://127.0.0.1:18123/rooms-check/kitchen` |
| Validated Core version | 2026.10.2 |
| Validated image | `ghcr.io/home-assistant/home-assistant@sha256:33afb0659d786213264c2211f8d91c5fe87461c56eba6a3a546eb05fc71e89f4` |
| Integration mount | The checkout/package's `custom_components/` → `/config/custom_components`, read-only |
| Runtime data | A separate temporary host directory → `/config`, writable |
| Smoke-test credentials | `/tmp/three-d-rooms-ha-session.json`, private disposable test credentials only |

The earlier containers were named `three-d-rooms-integration-check` and `three-d-rooms-loading-check`, sharing `/tmp/three-d-rooms-ha-check` as their config directory and never running simultaneously. **Inspect their mounts before reusing them**: the loading-check container points to an isolated `/tmp/three-d-rooms-loading-release` checkout, not necessarily the current project. These temporary directories/containers may no longer exist. Prefer recreating a known test environment rather than assuming a stopped container tests the latest code.

The standalone Node preview on port **5190** is useful for iteration but is not this environment. A successful localhost preview does not verify the native HA APIs, login, integration setup, persistence or automatic card loading.

#### 1. Build and choose the package to test

From the repository root, build the manager/card first:

```sh
npm --prefix rooms-app run build
```

For rapid development, mount this checkout's `custom_components/`. For the final artifact check, generate the integration ZIP from `rooms-app/` with `node tools/create-release.mjs`, extract the **intended version's** `releases/3d-rooms-<version>-integration.zip` into a new temporary directory, and mount that extracted `custom_components/` instead. This catches missing files and stale bundles in the actual artifact.

Both methods test real package files loaded by Core. They do not by themselves prove HACS repository discovery/download works; record any separate HACS-install check accurately. No HACS/GitHub sign-in is needed for the mounted-package runtime test.

#### 2. Start a fresh isolated instance

Docker must be available. Check existing containers and port 18123 first; do not start two HA processes against the same `/config`, and do not stop an unrelated container to free the port. The minimal local test needs no privileged mode, host networking, USB devices, D-Bus or production configuration.

Run the following from the repository root in one shell. Variables do not persist between independent tool/shell calls; retain their values or set them again for subsequent commands.

```sh
set -e
HA_TEST_REPO=$(pwd -P)
HA_TEST_CONTAINER=three-d-rooms-release-check
HA_TEST_CONFIG=$(mktemp -d /tmp/three-d-rooms-ha.XXXXXX)
HA_TEST_COMPONENTS="$HA_TEST_REPO/custom_components"
HA_TEST_IMAGE=ghcr.io/home-assistant/home-assistant@sha256:33afb0659d786213264c2211f8d91c5fe87461c56eba6a3a546eb05fc71e89f4

test -f "$HA_TEST_COMPONENTS/three_d_rooms/manifest.json"
test -f "$HA_TEST_COMPONENTS/three_d_rooms/frontend/three-d-rooms-card.js"

cat > "$HA_TEST_CONFIG/configuration.yaml" <<'YAML'
homeassistant:
  name: 3D Rooms Integration Check
  latitude: 46
  longitude: 14
  elevation: 0
  unit_system: metric
  time_zone: Europe/Ljubljana
frontend:
config:
api:
http:
websocket_api:
lovelace:
demo:
YAML

docker pull "$HA_TEST_IMAGE"
docker run -d \
  --name "$HA_TEST_CONTAINER" \
  -p 127.0.0.1:18123:8123 \
  -v "$HA_TEST_CONFIG:/config" \
  -v "$HA_TEST_COMPONENTS:/config/custom_components:ro" \
  "$HA_TEST_IMAGE"
```

For the artifact test, replace the `HA_TEST_COMPONENTS` assignment in the snippet with the extracted ZIP's absolute `custom_components/` path before running it. Record the selected checkout/package and runtime version in `VALIDATION.md`. The digest above pins the already-tested image; select and verify a different official tag/digest explicitly when testing other HA versions. Do not silently replace a reproducible version with a moving `stable` tag.

The `demo:` integration creates simulated light entities, including color and temperature capabilities. Do not use the obsolete `light: - platform: demo` setup; that failed on the validated Core version.

Check readiness and logs before running the smoke check:

```sh
docker logs --tail 60 "$HA_TEST_CONTAINER"
curl --fail --silent --show-error http://127.0.0.1:18123/api/onboarding
docker exec "$HA_TEST_CONTAINER" python -c 'from homeassistant.const import __version__; print(__version__)'
```

Startup can take time. Use bounded readiness checks and inspect errors instead of assuming the container is ready as soon as `docker run` returns.

#### 3. Bootstrap and exercise the integration

`integration-tests/live-check.mjs` targets **only** `127.0.0.1:18123`. It creates a disposable test account on a fresh instance, completes setup, adds the integration, uploads the local kitchen if absent, maps it to demo lights, tests services and private scene/export endpoints, and creates/overwrites the test dashboard `rooms-check`. It deliberately changes the **test** kitchen's mappings/state. Never retarget it at production.

Before bootstrapping a fresh config, move any existing `/tmp/three-d-rooms-ha-session.json` aside to a private backup location so credentials from a different test instance are not reused. For the same existing config, retain its matching session file; the script refreshes the test token. Do not print the file or put tokens/passwords in chat, Git, screenshots or URLs.

From the repository root, after readiness:

```sh
test -f model-exports/kitchen.zip
node integration-tests/live-check.mjs
```

The kitchen ZIP is an ignored private local fixture. If unavailable, use a prepared local model and adapt the test deliberately; do not commit a private scan to make CI pass. A login/API `401` from this script can mean mismatched/expired **test** credentials; inspect the local session/config pairing before diagnosing an integration bug.

Run the native Python tests in the HA image too. Copy directory **contents** so repeated runs do not nest the tests under another directory:

```sh
docker exec "$HA_TEST_CONTAINER" mkdir -p /tmp/three-d-rooms-tests
docker cp integration-tests/. "$HA_TEST_CONTAINER:/tmp/three-d-rooms-tests/"
docker exec "$HA_TEST_CONTAINER" python -m unittest discover -s /tmp/three-d-rooms-tests -p test_native.py -v
```

The browser has its own login session. Sign into the local test UI with the disposable account created by the smoke check (its username/password are in the private session file), not the user's production credentials. For browser automation, read those values locally and fill the normal login form without exposing them in tool output.

#### 4. Check the manager and real dashboard components

Use the local HA pages, rather than `card-demo.html`, for final native checks:

1. Open `/three_d_rooms`: confirm the real manager loads the model and can edit entity mappings. Verify a demo light's on/off, brightness, RGB and white temperature where supported, and ensure off retains minimum room visibility.
2. Open `/rooms-check/kitchen` directly or in a fresh browser page. The bundled card must load without visiting the manager first and without manually installing another card/resource.
3. Test the physical fixture and any intended click/hold controls against the mapped **demo** entity. Confirm actual HA state changes update the room. Check unsupported/unavailable/unmapped controls do not send inappropriate commands.
4. For saved Components changes, create a named component in the manager, adjust its room/view/rotation/tilt/zoom/height, save it, reopen it and verify the live preview. Copy its generated YAML into a real Manual dashboard card. Check duplicate, JSON export/import and removal on disposable test components when those behaviors are affected. Do not infer dashboard behavior from the preview alone.
5. Restart HA with the **same config directory**. Verify uploaded models, mappings and saved components survive. For upgrade tests, keep that config while switching the mounted package/version; do not wipe storage and call a fresh setup an upgrade test.
6. For loading changes, test first visit, manager-to-dashboard navigation, revisit and refresh. Check compression and authenticated ETag `304` behavior, session-cache isolation and retry. Keep network-transfer timings separate from GLB preparation/first-render timings; the canvas diagnostic attributes `data-prepare-ms` and `data-first-render-ms` can help with the latter.
7. Check relevant narrow layouts, browser errors and container logs. Save a screenshot of the final native UI when useful. Record what passed and what remains untested; local Core checks do not validate the user's HA OS/Proxmox VM, physical iPhone/lights, Supervisor/add-on updates, or actual HACS download flow.

#### 5. Iterate, restart and clean up

- JavaScript/CSS changes: rebuild `rooms-app`, then reload the HA browser completely so it imports the rebuilt module. Hot reload on port 5190 is not a reload of the native package. Bump `const.py`'s application version before shipping so existing users get the new module URL.
- Python, configuration, integration version or registration changes: restart the local HA container, wait for readiness, and refresh the browser.
- A changed host source directory or source-versus-ZIP mount requires recreating **your own** test container with the corrected mount. `docker restart` does not change a container's mounts.

```sh
docker restart "$HA_TEST_CONTAINER"
docker inspect "$HA_TEST_CONTAINER" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
docker logs --tail 80 "$HA_TEST_CONTAINER"
```

After verification, stop your own test container and close temporary browser tabs:

```sh
docker stop --time 30 "$HA_TEST_CONTAINER"
```

Retain the matching temporary config/session only if needed for a later persistence/upgrade check; otherwise clean up your own disposable data. Never delete or overwrite the user's real HA configuration or their only room export. A stopped container can be resumed with `docker start` only after verifying its config, mounted package and port still match the intended test.

## Increasing the application version

Choose a fresh semantic version after checking both manifests and GitHub releases/tags. Use patch versions for compatible fixes, minor versions for compatible features, and major versions for breaking changes. Do not reuse a published version or move an existing release tag. Do not label unreleased features as already shipped.

Update **all** these values for a shipped application change:

| File | Value |
| --- | --- |
| `custom_components/three_d_rooms/manifest.json` | `version` |
| `custom_components/three_d_rooms/const.py` | application `VERSION` |
| `rooms-app/package.json` | `version` |
| `rooms-app/package-lock.json` | top-level `version` and `packages[""].version` |
| `rooms-app/config.yaml` | legacy add-on `version` |

`npm version <new-version> --no-git-tag-version` from `rooms-app/` can update the package and lockfile versions; it does **not** update the Python manifest/constants or add-on YAML. Update those too.

Do **not** change `hacs.json`'s `homeassistant` field to the application version: it is the minimum supported HA version. Do not bump config-flow `VERSION`, catalog/storage versions, or model `schemaVersion` merely because the app version changed; those are schema versions.

Add a clear version heading and entry to `rooms-app/CHANGELOG.md`; move only the features included in this release out of any Unreleased section. Update `README.md`, legacy `rooms-app/DOCS.md` and `VALIDATION.md` as needed. Preserve historical release numbers and migration instructions. Record actual checks and remaining limits, without fixed test counts copied from an older release.

Rebuild after the bump. Verify that all application versions match before packaging:

```sh
python3 - <<'PY'
import json
from pathlib import Path
import re
root = Path('.')
read_json = lambda p: json.loads((root / p).read_text())
lock = read_json('rooms-app/package-lock.json')
values = {
    'manifest': read_json('custom_components/three_d_rooms/manifest.json')['version'],
    'constant': re.search(r'^VERSION = "([^"]+)"', (root / 'custom_components/three_d_rooms/const.py').read_text(), re.M)[1],
    'package': read_json('rooms-app/package.json')['version'],
    'lock': lock['version'],
    'lock root package': lock['packages']['']['version'],
    'legacy addon': re.search(r'^version:\s*"([^"]+)"', (root / 'rooms-app/config.yaml').read_text(), re.M)[1],
}
assert len(set(values.values())) == 1, values
print('Application versions agree:', next(iter(values.values())))
PY
```

## Preparing release assets

After the final build, run **from `rooms-app/`**:

```sh
node tools/create-release.mjs
```

It reads the package version and writes these ignored, local artifacts under repository-root `releases/`:

- `3d-rooms-<version>-integration.zip`: optional manual installation, containing `custom_components/three_d_rooms/` and its bundled frontend.
- `3d-rooms-<version>-source.zip`: legacy add-on migration/development source, not an additional install requirement.
- `three-d-rooms-card-<version>.js`: compatibility/manual card artifact, not a required second HACS download.

Inspect ZIP contents: correct folder structure, complete compiled frontend, matching manifest version, no credentials/private models/runtime data. Include only appropriate artifacts in the release. HACS normally obtains the integration from the tagged repository's `custom_components/three_d_rooms/`; uploading a ZIP does not substitute for committing the package correctly. Do not set `zip_release` unless intentionally changing and testing that installation mechanism.

## Committing, pushing and creating the GitHub release

When shipping is authorized by the current task/session, complete the release rather than stopping after a local build. A request to edit this guide alone is not a request to release the application.

1. Review the complete intended diff and generated assets. Stage only reviewed changes. Stop on failed checks; do not let a later successful command hide an earlier failure.
2. Commit source, synchronized versions, changelog/validation, and rebuilt tracked bundles together. Release ZIPs stay ignored and are attached separately.
3. Recheck the remote branch before pushing. If another change has landed, integrate it without overwriting anyone's work; rebuild/retest/repackage if the release content changes. Never force-push to resolve a concurrent release.
4. Push the verified commit, then create a **published** GitHub release tagged `v<version>` targeting that exact commit. A draft is not a completed HACS update; use a prerelease only when intentionally shipping a preview.

Example from the repository root, after committing and verifying the intended version. Replace the example version and write complete release notes to the indicated file first:

```sh
RELEASE_VERSION=0.4.2
RELEASE_COMMIT=$(git rev-parse HEAD)
RELEASE_NOTES=/tmp/three-d-rooms-release-notes.md
git push origin HEAD:main
gh release create "v${RELEASE_VERSION}" \
  --repo astritzeqiri/ha-3d-rooms \
  --target "$RELEASE_COMMIT" \
  --title "3D Rooms ${RELEASE_VERSION}" \
  --notes-file "$RELEASE_NOTES" \
  "releases/3d-rooms-${RELEASE_VERSION}-integration.zip" \
  "releases/3d-rooms-${RELEASE_VERSION}-source.zip"
```

Keep actual paragraph breaks in release notes. Use `--notes-file` rather than shell-interpolated multiline prose. Notes should explain the user-visible change, installation/update steps, migrations, relevant validation and material limits. Do not attach household assets or include secrets in URLs, commands or logs.

Use the existing GitHub authentication. If the normal credential helper fails while `gh` is already authenticated, a per-command fallback used for this repository is:

```sh
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin HEAD:main
```

Do not change global credential configuration or expose tokens. After publishing, verify the remote commit/tag and release assets, for example:

```sh
git ls-remote origin refs/heads/main "refs/tags/v${RELEASE_VERSION}*"
gh release view "v${RELEASE_VERSION}" --repo astritzeqiri/ha-3d-rooms --json url,tagName,isDraft,isPrerelease,assets
```

If a release already exists, inspect it. Do not silently overwrite assets, reuse its version, delete it or retarget its tag; choose a fresh version for changed shipped code.

## What to tell the user after publishing

- State the published version and link its release; summarize what changed and what was actually tested.
- Normal update: **HACS → 3D Rooms → update/download the new version → restart Home Assistant itself → refresh the browser**. An add-on restart does not reload the native integration. Mention unchanged rooms/mappings when verified.
- The HACS repository type is **Integration**. The legacy add-on entry has its own version/update system and is not updated by reinstalling HACS. Do not instruct users to install both packages for normal operation.
- For first install: add the integration under **Settings → Devices & services → Add integration → 3D Rooms**, then use its sidebar. The bundled card loads automatically; avoid duplicate old `/local` or `/hacsfiles` card resource entries.
- For migration from the legacy add-on, retain it until the exported room/mappings work in the integration. Never uninstall it as a prerequisite that destroys the only copy of their data.

## Upstream references

Check current primary documentation when changing packaging or release behavior:

- HACS integration packaging: https://www.hacs.dev/docs/publish/integration/
- GitHub CLI release creation: https://cli.github.com/manual/gh_release_create
