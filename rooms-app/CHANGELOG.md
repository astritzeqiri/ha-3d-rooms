## 0.41.4

- **The full-screen page really fills an iPhone home-screen app.** The page's own full-height styles made iOS shrink its viewport by the status bar, so the room and its bottom controls stopped short of the bottom of the screen above an empty band (0.41.3 made the clipping worse). The page now lets iOS size it, and the room reaches the bottom edge with its controls above the home bar. Reproduced and checked in an iOS 27.2 home-screen app.
- **Bigger, easier-to-tap controls on phones.** The top-left lights and shades buttons, the time-of-day switch and the bottom-right toolbar (floors, camera, reload) are 44 px on phone-sized cards, as on larger screens. On the full-screen page the top row sits a little further below the status bar.
- **No text selection when holding a device.** Holding a marker to open its pop-up no longer selects text or shows the iOS Copy / Look Up menu.
- **A Home Assistant-style desk pop-up.** The adjustable desk opens a pop-up like the light one: a header with close, the desk's height, a large vertical height slider, round Up / Stop / Down buttons and the desk's macros with their icons. On phones it slides up from the bottom. It follows the Home Assistant theme on dashboards.
- **Tap outside to close the lights and shades panels.** On dashboards and on the full-screen page, tapping anywhere outside the open Room lights or Room shades panel closes it.
- **0% turns a light off.** On the full-screen page's light pop-up, dragging brightness to the bottom turns the light off instead of leaving it on at its lowest level, and a light that is on never shows 0%.

## 0.41.3

- **No empty band at the bottom of the full-screen page on iPhone.** In a home-screen app, iOS reports a screen height that leaves out the status bar, so the page stopped about one status bar short of the bottom of the screen. The page now measures the status bar and, when the reported height plus the status bar matches the screen exactly, uses the full screen height. It checks again on rotation. Browser tabs, split views and screens that already report the right height are unchanged.

## 0.41.2

- **Full-screen page fits an iPhone home-screen app.** Added to the home screen from Safari, the page drew under the status bar: its buttons at the top (room lights and shades, time of day, room navigation) were hidden behind the clock and the Dynamic Island, and the room stopped short of the bottom of the screen because iOS reports a viewport that is too short there. The page now fills the whole screen, and its floating controls stay inside the safe area (below the status bar, clear of the notch in landscape, above the home bar) while the room itself still runs edge to edge. Dashboard cards are unchanged. If you already added the page to your home screen, remove it and add it again after updating so iOS picks up the new layout.

## 0.41.1

- **One click to the full-screen page.** Every card in **Dashboard views** has an **Open full screen** button, and the view editor's toolbar has a **Full screen** button beside Background. Both open the view's full-screen page in a new tab (the editor button appears once the view is saved, since the page shows the saved view).

## 0.41.0

- **Dashboard view previews follow the background.** A saved view's gallery preview used to be a flat picture with the sky or spotlight baked in at the moment you saved, so it went stale when the background changed, or when the room switched between day and night. Saving now also stores the room on its own, and the gallery draws it over the view's current background, so the preview always matches the card. Views saved before this keep their old preview until you save them again.
- **A full-screen page for one dashboard view, with no Home Assistant menu.** Open **Dashboard views → Add to dashboard** and use **Full-screen page**: it gives a link like `/three_d_rooms_view/<view id>` that shows only that saved view, filling the screen, with no sidebar, header or menus. It signs in with the Home Assistant login the browser already has (or sends it through the normal Home Assistant login once), so nothing is public and only administrators can use it. Bookmark it, add it to a phone's home screen or open it in a wall tablet's kiosk browser. The card behaves as on a dashboard, including live light/door/lock states; marker icons, including icons you chose per view and custom icon sets, are drawn as in Home Assistant, and holding a device opens a compact pop-up (power, brightness, colour, covers, locks, climate). The pop-up is laid out like Home Assistant's own: a large brightness or position control, round feature buttons for power, colour temperature, colour and effects, an arc dial for the air conditioner with mode, fan, swing and preset choices, a big lock button, and an Attributes list. The Edit shortcut is not available there. Rooms, views and mappings are unchanged.

## 0.40.0

- **Card backgrounds, saved with the view.** The dashboard view editor has a new **Background** button (next to Floor plan and Reset camera) that opens a picker showing every background behind the view's own house, with a Day / Golden hour / Dusk / Night preview. The choice is saved with the view and previews live in the editor and in the saved view's thumbnail. Backgrounds: Spotlight (the new default, a soft light behind the house), Classic (the previous flat dark fill), Blueprint grid, Sky (follows the Day / Night switch and the real sun, with stars at night), Aurora (slow ambient colour), Custom image (a `/local/…` or web address, dimmed behind the house) and Home Assistant theme. A "Soft shadow under the house" option (on by default, off for Classic and the floor plan view) anchors the model. A card linked to a saved view follows its background; the card editor shows it and can override it with `background`, `background_image` and `background_shadow`. The room is drawn on a transparent canvas above a CSS layer, so a background adds no 3D work.

## 0.39.0

- **Opening a room or floor no longer freezes the card.** The first time a room, floor or the house was shown, the browser had to build that view's shaders on the spot, which blocked the page for up to several seconds on a large room (arrows, room buttons and the floor buttons alike). House and floor cards now build every room's and floor's shaders in the background shortly after loading, using the graphics driver's own threads, so switching afterwards takes a few tens of milliseconds. If you switch before that has finished, a small "Opening …" spinner shows while the view is prepared, and the page stays responsive.
- **Edit button on dashboard cards.** Administrators get a pencil in the card's bottom-right toolbar that opens this card's saved view (or its room or house) in the 3D Rooms editor in a new tab. Turn it off with `edit_button: false` or the card editor's "Show the Edit button" checkbox. It is not shown to other users, in previews or in the legacy add-on.
- **No needless page scroll.** The manager page was sized for the top bar alone and ignored the My home / Dashboard views bar below it, so it scrolled by about 75 px even with nothing underneath. On wide, tall windows the Overview 3D view and side panel now also fit the space under the header.
- **A much more compact room and house header.** On screens wider than 900 px the house link, title and room type share one line, the tabs share a bar with the device count (the "All devices connected" note is gone), and Floor plan / Reset camera float over the top right of the 3D view instead of taking their own row. The header is about half its old height on the Overview, Devices and Settings tabs. A single room no longer shows the "Whole house" switch (use the house link); house and floor views keep it. Phones and tablets keep the stacked layout and full-size touch targets.
- **The view editor's icons are Home Assistant's icons.** A connected device's marker in the Devices tab and the view editor now shows the same icon Home Assistant draws for its entity and state, as the dashboard card does, instead of a generic glyph. Devices without an entity keep the generic default.
- **Separate icons for the active and inactive state.** The pencil panel (view editor) and a room's icons (Devices tab) have two icon rows for lights, switches, covers, locks and climate: one shown when the device is on, open or locked, and one when it is off, closed or unlocked. A single chosen icon still shows in both states (as before), and a device with no chosen icon keeps Home Assistant's own state icon, so it stays connected to the entity. Saved as `icon` and `icon_off` in a view's `markers.<device>`; a room's icons are served as `icon` and `iconOff`. No migration needed.
- **Clearer icon editing in the view editor.** When an icon is selected, the other icons fade (and return on hover), the selected one gets a thicker outline and a dashed ring, and its four tool buttons are accent-coloured so they read as belonging to it.
- **The previous/next room arrows stay put.** The House button between them used to resize with the room's name, so the arrows moved as you stepped through rooms. It now has a fixed width (shorter on narrow cards) and a long name is cut with an ellipsis.

## 0.38.0

- **View one room on its own from a house or floor card.** A room that is hidden behind other rooms in the house view gets a button in front of it (its name with a small expand icon). Tapping it shows only that room, framed like the room's own card, with its devices, lights and shades. A "House" button at the top (or Escape) returns to the house or floor you came from; the floor switcher also leaves the room. Switching is instant (the house is already loaded) and nothing is saved. Buttons that would cover each other move apart.
- **Choose when and where room buttons show, per dashboard view.** When you build a house or floor view, every room's button appears in the 3D view. Drag one to move it, also beside the model; it moves on a horizontal plane at its height and stays fixed to the model as the camera turns, and the camera does not move while you drag. Click a button for round sub-buttons, like the device icons': when it shows (Automatic, only while other rooms cover most of the room, the default; Always; Never), its size, up/down dragging, its opening angle and reset. Faded buttons are ones the card would not show. The choices are saved with the view and used by cards that follow it, or set by hand in the card's `markers._rooms`. Turn all room buttons off for a card with `room_focus: false`.
- **Room buttons show what is on and can switch the lights.** A button shows how many of its room's lights are on (yellow). Hold it to switch the room's lights (anything on turns all off, otherwise all on, the same as the Lights panel); tap it to open the room. Hovering or focusing a button outlines the room in the house.
- **Double-tap a room to open it.** On house and floor cards, double-tapping (or double-clicking) a room, not one of its device icons, opens it on its own, so visible rooms need no button.
- **Previous and next room.** While a room is open, arrows either side of the House button (and the Left/Right keys) go to the neighbouring room, wrapping round.
- **Choose each room's opening angle.** In a room button's sub-buttons, the camera button shows the room on its own; turn it to the angle you want and press "Use this angle" (or "Automatic angle" to clear it). Cards that follow the view open that room at that heading and tilt (`markers._rooms.<room>.heading` / `tilt`).
- **Raise and lower room buttons.** Hold Shift while dragging a button, or switch a room to Up/down, to move it vertically instead of sideways.
- **Room button size and a three-state eye.** A room button's sub-buttons include Size (Small, Standard, Large, Extra large; saved as `markers._rooms.<room>.size`, 20–64 px), and the eye button looks different in each of its three states: an eye with an A (Automatic), a filled eye (Always) and a crossed-out eye (Never).
- **Icons under another room no longer show through.** On house cards, the icon of a device that lies under another room (the Office light below the Primary bedroom's floor) is hidden. The scene works this out from what it actually draws once the camera has stopped, so it follows the camera, and floor views and single rooms are unaffected.
- **Automatic height for dashboard views.** The view editor's Height has Fixed (pixels) and Auto, as the card does. A fixed height still shows the editor at the card's size; Auto makes the editor use the free height of the screen (following window resizes) and the card fills the space the dashboard gives it (saved as `height: auto`; the preview dialog uses 600 px).
- **Tooltips in the view editor.** Hovering (or tabbing to) any button or room button over the 3D view in the view editor shows its name at once in a small bubble beside it, instead of the browser's delayed tooltip. Touch taps show none. Dashboard cards keep the browser's own tooltips.
- **Smaller, quieter buttons on narrow cards.** On cards narrower than about 520 px (phones and the phone preview) the toolbar, Lights/Shades, floor, day/night and room navigation buttons are 34 px instead of 44 px, with softer, translucent backgrounds and the same touch area. Wider cards are unchanged.
- Fix: the day/night switch sat 12 px lower and 16 px further in than the Lights and Shades buttons on a card without a title.
- House and floor views now light only through the windows of the rooms they show, so a focused room no longer has other rooms' window panes floating around it.
- House views carry a `roomTitles` map (room ID to name) so rooms without devices can have buttons; renaming a room does not make cards download the house again.
- Fix: replacing a room's model kept its name and area but dropped "Group this room's icons in house views"; it is kept now.

## 0.37.0

- **Optional room grouping in crowded house views.** A new room setting, "Group this room's icons in house views" (off by default), shows that room's icons on house and floor cards as one chip with the room name and device count (yellow when something is on) when they overlap. Tap the chip to see the icons in their real places; tap elsewhere or press Escape to group them again. Zooming in until the icons separate ungroups the room on its own.
- **Save stays in reach in the view editor.** The Preview / Save / Use in dashboard buttons sit in a bar at the bottom of the screen while the settings scroll, with a coloured "Unsaved changes" state.
- **Room settings save as you edit.** Name, area, floors and room appearance save when you change them; there is no Save button any more. Only the changed setting is sent. A room named like "Office · your scan" offers a one-click rename to "Office".
- **Getting started.** The Overview panel lists three steps for a house or room (connect devices, place the icons, create a dashboard view) with its progress; each step opens the place where it is done. It disappears when done, or with Hide.
- **Undo for room icons.** On the Devices tab, Undo (and Ctrl/⌘+Z) takes back a room icon's last move or icon change.
- **Cards show the view's picture while loading.** A card made from a saved view shows that view's thumbnail behind the progress message, then fades to the 3D room. The picture is remembered in the browser for the next visit.
- Fix: changing a room's name or area could clear its house floors when the house floors were not linked to Home Assistant floors.
- Browsers now load a new card after every update, also between builds of the same version.

## 0.36.0

- **A stopped 3D view says so and can be reloaded.** If the browser takes the graphics context away (a GPU reset, memory pressure), dashboard cards and the manager used to show a blank canvas. They now show a message with a "Reload 3D view" button, and redraw on their own when the browser restores the context.
- **Room names without the scan suffix.** "Office · your scan" and "Corridor · November scan" are shown as "Office" and "Corridor" in the card's Lights and Shades panels, marker labels, device dialogs and the manager's headings. Stored names and ids are unchanged.
- **Devices tab keeps the model in view.** On wide screens the device list sits beside the 3D room; on narrower screens the room stays pinned above the list. Rooms whose lights are all off are lit enough in the manager to find their devices.
- **Scrolling no longer zooms by accident.** In the manager, the mouse wheel scrolls the page until you click or drag the model; Ctrl/⌘ + wheel and trackpad pinch always zoom.
- **Connect a room's devices together.** "Connect devices" lists entities whose names match unconnected devices. Close matches are ticked; one button connects the ticked ones.
- **Download progress on cards.** Loading shows a progress bar with the room count for houses and a percentage or megabytes for single rooms.
- **A tidier Devices list.** Each row's expand arrow sits on the left, lined up in every row. Status dots and icons use state colours: green locked, red unlocked, purple open, the light's colour when on, a grey ring when not connected. Control mode (Live or Simulation) moved to the top of the list it affects. Pointing at a row highlights that device in the model, and selecting a device in the model opens its row. Floor plans in the manager show device markers too.
- **Room icons, set once in the Devices tab.** The room model on the Devices tab shows each device's real icon. Drag an icon to move it, or click it to choose another icon (any Home Assistant icon, including your own icon sets) or put it back. These are saved with the room: dashboard cards, house and floor views, and every dashboard view start from them. A view can still move an icon or pick another one for itself. Replacing a room's model keeps the icons of devices that still exist.
- **Easier marker taps.** Small device markers on cards keep their size but accept taps in a 44-pixel area.
- **The My home / Dashboard views switch stays in view.** It used to scroll away with the page; it now stays pinned under the header (at the top on phones), and the Spaces panel sits below it.
- Smaller fixes: screens open at the top instead of the previous scroll position, clearer floor help in room settings, tidier Dashboard views wording and buttons.
- No migration or re-upload is needed.

## 0.35.0

- **Time of day is a three-icon switch.** The Day/Night/Auto dropdown on dashboard cards is now a row of three icons (auto, sun, moon). Click one and the highlight slides onto it; the choice is saved with the room, as before. Arrow keys move the choice too.
- **Light effects play in the 3D room.** When a light runs an effect, its modelled lamp and the light it casts animate on dashboard cards and in the manager:
  - Zigbee identify effects play once for their standard length: `blink`, `breathe` (15 seconds), `okay` (green flashes) and `channel_change` (orange, 8 seconds). `stop_effect` and `finish_effect` end them. They are picked up from the service call, so triggering the same effect again replays it.
  - Lasting effects play while the light is on and reports them: colour loop/rainbow, candle/fire/flicker, pulse/breathing and strobe (shown at a gentle two flashes a second).
  - Other effect names are not animated. Nothing animates when your device asks for reduced motion.
- No migration or re-upload is needed.

## 0.34.0

- **Markers show their state in colour.** On dashboard cards and in the view editor, a device's marker is filled with its state colour, using your Home Assistant theme's colours:
  - **Locks:** green when locked, red when unlocked or jammed, orange while locking or unlocking.
  - **Lights:** the light's own colour when it reports one, otherwise amber, while on.
  - **Air conditioners:** blue cooling, orange-red heating, orange drying, cyan fan only, green auto.
  - **Shades, windows and doors:** purple while open or moving.
  - Off, closed, unavailable and unconnected devices stay neutral, as do presets and desks.
- No migration or re-upload is needed.

## 0.33.2

- **The 3D Rooms sidebar always shows the current version after an update.** The manager page was loaded from an address without a version, so a browser could keep showing the previous release's page. One visible effect: a door lock listed under Lights as "Light · on/off", offering light and switch entities, because the old page did not know locks. The address now carries the app version, so every update loads a fresh page. Locks appear in their own Locks section and connect only to `lock.*` entities.
- No migration or re-upload is needed.

## 0.33.1

- **Open dashboard cards stay up to date.** A card that was reloading when a room changed (for example hiding a device right after another edit) missed that change until the page was refreshed. Cards now keep listening while they load and recheck once loading finishes, so newly hidden devices drop out of the Lights and Shades switches, and new mappings appear, within a couple of seconds.
- No migration or re-upload is needed.

## 0.33.0

- **Lights and Shades panels on dashboard cards.** Two new buttons at the top left of the card open a panel listing each room's lights or shades (a house card lists every room; a floor card lists that floor's rooms). Expand a room to switch single devices or open their Home Assistant details; hovering a row highlights its marker in the room.
- **One switch per room, and one for everything.** Each room has a switch for all its lights (or shades), and the panel header has an All switch. If anything is on (or open), the switch turns everything off (or closes it); otherwise it turns everything on (opens it). The All switch asks for confirmation first.
- **Hidden devices are never switched.** Devices hidden in a room are left out of the panels, and the room and All switches skip any entity that a hidden device also uses.
- **Shades** are the covers your model animates as roller shades/shutters; doors, windows and desks are not included. Shades connected to read-only contact sensors are listed but cannot be switched.
- Card options `light_panel: false` and `shade_panel: false` (also in the card editor) hide the buttons. House views now tell the card each device's room name.
- No migration or re-upload is needed.

## 0.32.0

- **Door locks.** A new `lock` device type maps to `lock.*` entities. The 3D lock's thumb-turn shows the real locked/unlocked state, and the marker shows Locked, Unlocked or Jammed. The manager has Lock/Unlock buttons under Devices → Locks. On a dashboard, tapping the lock opens Home Assistant's own lock dialog instead of toggling it. Locks that need a code are never unlocked from 3D Rooms.
- **Nested controls stay clickable.** A lock mounted on a hinged door keeps its own click target when the door moves.
- **Choose each device's icon per view.** The view editor's pencil panel has an Icon row with Change. Pick from suggestions, search every Material Design icon, or use your own Home Assistant icon sets such as `local:` (listed first). Dashboards draw the icon through Home Assistant. The full icon set loads only when the picker opens.
- **Switch-backed lights toggle again.** A light marker connected to a `switch.*`, `input_boolean.*` or `fan.*` entity now toggles through that entity's own domain, falling back to `homeassistant.toggle`. Before, a dashboard click on such a marker did nothing.
- No migration or re-upload is needed for existing rooms. A room that declares a lock needs this version.

## 0.31.0

- **Faster on phones.** Phones and touch-only tablets render the 3D room with a lighter profile: at most 1.5× pixel density, no edge smoothing on dense screens, smaller shadow maps and a cap on shadow work (window shadows first). Every light still lights the room and stays controllable. On every device, moving the camera reuses the room's shadows instead of redrawing them each frame.
- **Rendering quality card option.** `quality: auto | high | low` (Rendering quality in the card editor). Automatic is the default; High keeps full quality on phones.
- **Lighter room models, automatically.** Home Assistant makes a desktop and a phone copy of every room next to your upload: identical textures are stored once, large ones are shrunk (2048 px desktop, 512 px phone) and saved as WebP. Existing rooms are processed once after updating; your uploads are never changed and Export still returns them. Cards download the phone copy on phones.
- **Optimize for phones and desktops.** Room settings → Faster loading compresses a room's geometry and converts its textures to KTX2, which stay compressed on the graphics chip. It runs in the browser and starts automatically after you upload or replace a room. Device, door and room data are checked to be unchanged before Home Assistant accepts the copy.
- No migration or re-upload is needed.

## 0.30.2

- Window and door groups can now be connected to a `binary_sensor` (contact sensor) as well as a `cover`. Every window or door in the group shows the sensor's Open/Closed state; sensors are read-only, so open/close buttons stay disabled. Groups that include a desk still require a `cover`. Existing groups are unchanged; no migration is needed.

## 0.30.1

- In the Home Assistant sidebar, the entity picker for windows, doors and shades now actually lists `binary_sensor` entities (contact sensors). 0.29.x added them to the backend list, but the native sidebar panel builds its own entity list and still filtered them out. No migration is needed.

## 0.30.0

- Replacing a full house now matches rooms that were re-added in the house app (new internal room ID) by their name, so they keep their name, area, device mappings, light groups and hidden devices instead of being removed and recreated. Device mappings follow their control by ID, then by name and type.
- The replacement preview is now a per-room review: choose which existing room each room in the ZIP replaces (or add it as new), see which device mappings are kept, matched by name or not matched, and pick a different device or drop a mapping before confirming. No migration is needed.

## 0.29.1

- The entity picker for windows, doors and shades now lists every `binary_sensor`, including contact sensors that have no door/window device class set. In 0.29.0 those were hidden.

## 0.29.0

- Windows, doors and shades can now be connected to door/window contact sensors (`binary_sensor` entities), not only `cover` entities. The sensor's state shows as Open/Closed and moves the window or door in the 3D room. Sensors are read-only, so open/close buttons stay disabled for them. Desk controls still require a `cover`. Existing mappings are unchanged; no migration is needed.

## 0.28.0

- House and floor views show the Auto/Day/Night switch again. They combine every room's daylight windows at their placed positions, and changing the time of day on a house or floor card saves it to each room it shows. No migration is needed.
- Room Devices view redesigned as a compact list:
  - One slim row per device: type icon, name, status (for example "On · 71%", "70% open", "Not connected") and a quick action. That is a toggle for lights, ▲ ■ ▼ for shades, Closed/Open for windows and doors, or Connect when no entity is linked.
  - Clicking a row expands the full controls in place, one at a time, and highlights the device in 3D.
  - Sections fold and show counts ("4 of 9 on · 5 need an entity").
  - A ⋯ menu on each row holds entity/group and Hide device, and one Group devices menu replaces three header buttons.
  - Rows stay on one line at phone width, and the phone search box no longer grows to 200px tall.
- Group shades and group windows & doors, alongside light groups. In a room's Devices tab, choose two or more shades (roller shutters) or windows/doors (hinged or sliding leaves) to share one Home Assistant `cover` entity. They show as one control and move together, with the same editing, ungrouping and binding restoration as light groups. A group holds one kind of device (lights with a `light`/`switch` entity, covers with a `cover` entity). Existing light groups and their storage are unchanged, so no migration is needed.
- Sliding doors: room packages can mark a cover root with `slidingDoor` motion (`axis: "x"`, `closedOffset`, `openOffset`, `defaultPosition`). The leaf translates along its parent's local x between the two rest positions, works with binary open/closed covers, and is validated on import (unique root, children, 0–5 m travel, not combined with a hinge).
- House and floor dashboard cards show bottom-right floor buttons (All plus one per floor). The house loads once and floors switch instantly in place, with no reload or extra download. The choice is per card and per browser session; it never changes the saved card or room. Turn it off with `floor_selector: false` or in the card editor; a floor card with the switcher off still loads only its own rooms.
- Cards gain bottom-right Move camera and Reset view buttons, in one toolbar with the floor buttons, Reload and fullscreen (floors wrap above on narrow screens). Move camera starts from the card's camera-movement setting and only changes this session; Reset view returns to the card framing. Hide them with `camera_controls: false` or in the card editor.
- Floor-plan cards pan with a one-finger or left drag when camera movement is on, and locked cards let phones scroll the page over the 3D view.

## 0.27.0

- Reuse decoded models between dashboard cards and tab revisits, with session isolation, revision keys, bounded memory and retry after failure.
- Add a bottom-right Reload models control beside fullscreen to clear the session cache and reload the active view.

# 0.26.0 — room device management

- Group modeled lights into one named control connected to a shared Home Assistant entity. Edit or ungroup while retaining original fixtures and connections.
- Hide devices globally from their room’s Devices screen; only Show device in that room restores them. Covers room, floor, house, dashboard trays and view editors.
- Click a device bubble on the Devices screen to open its settings or light-group editor.
- Retains the 0.25.1 rendering fix and existing fullscreen/auto-height features.

# 0.25.1 — Restore textured floors and furniture

- Prevent missing surfaces when fixture and daylight shadow maps exceed the graphics device’s texture limit.
- Budget shadows against material textures and device capacity in both the manager and dashboard card. All lights remain visible and controllable.
- Existing uploaded rooms work without re-exporting or re-uploading.

# 0.25.0 — Dashboard workspace and device presentation

- Dashboard cards can fill the available screen height with `height: auto`, selectable in the visual card editor.
- Added a fullscreen button in supported browsers; device dialogs return to the normal dashboard.


- Edit linked card fields directly, with a small per-field Reset action only for changed values. Remove the repeated override checkboxes; resetting or typing the inherited value restores the saved-view link for that field.

- Use the viewer’s wall-mounted AC icon in dashboard device controls, including the tray and live entity updates.

- Center device icons on their projected model anchors in the view configurator and dashboard cards; remove the unintended rightward screen offset while retaining explicit position overrides.

- Set view-wide device defaults for visibility, state labels, size and room/tray display; override individual devices or restore inheritance without resetting their position.

- Refine workspace navigation, action buttons, focus states and phone layouts.
- Make Floor plan switch directly to a true top-down orthographic camera.
- Show and configure device buttons in whole-house and floor views, retaining source-room entity connections and saved presentation settings.

- Preview and replace a complete house ZIP atomically, preserving matching room identities, compatible mappings and settings.
- Review and delete an entire house, including its rooms and saved views, without deleting Home Assistant devices.
- Reject stale confirmations if the library changes; preserve unrelated houses and rooms.
- Search house, floor and room names in the shared space chooser, with keyboard selection and clear no-match feedback.
- Create every view in a top-level Dashboard views workspace, alongside My home. Browse all existing views with search and house/floor/room filters.
- Use one space chooser and camera editor for whole houses, floors and individual rooms. Exported floors remain available without requiring Home Assistant floor links.
- Change a saved view’s space without changing its identity or breaking linked dashboard cards; preserve drafts on cancelled navigation or a failed model download.
- Import, export, duplicate and preview saved views from one global gallery. Existing storage, room mappings and saved-view IDs remain compatible.

# 0.24.0 — Full-house imports and workspace

- Import a complete house ZIP with all rooms, placements, floors and mappings in one atomic operation; invalid or duplicate imports leave the library unchanged.
- Navigate houses with a compact room sidebar, floor filter and phone drawer; inspect and highlight rooms in the combined house view.
- Preview ZIP contents before import, group devices by type, and select Simulation or Live controls explicitly.
- Correct camera fitting for positioned rooms and retain existing room identities, mappings and saved views.
- Keep AC state and native controls available in the manager; show climate mode effects on prepared models and correct AC icons/status in the dashboard-view editor.

# 0.23.0 — Houses, floors and room appearance

- Assemble independently imported rooms using portable house placement and floor metadata; retain each room’s identity, controls and mappings.
- Choose Home Assistant floors for whole-house dashboard views. Multi-floor rooms are clipped to the selected floor’s saved height range.
- House/floor views expose presentation settings only. Device setup and actions remain in individual rooms; composed models retain live room appearance.
- Room appearance can show or hide optional architectural sections. Updated hallway exports separate the wall above the entrance from the entrance door and casing.
- Preserve compatible placement, floor, appearance and entity settings when replacing a room.
- Support prepared hinged-door cover motion and binary-cover state; prepared AC controls open Home Assistant’s native climate dialog.

# 0.22.0

- Customize each device icon independently in a saved dashboard view: visibility, state label, size and room/below-room placement.
- Drag room icons directly onto model surfaces. Use Position for click-to-place, reset or precise X/Y/Z offsets. Changes remain anchored in 3D and follow moving devices.
- Open compact fan-out actions by selecting an icon: Undo, Edit icon, Position and an eye for visibility. Undo affects only the selected device during the editing session. Clicking outside clears selection and focus.
- Keep hidden controls faded and selectable in the editor with a Hidden pill while omitting them from dashboard cards. Centre native Home Assistant symbols at every icon size.
- Preserve authored camera framing across editing, saving and resizing, improve phone/tablet layouts, and store bounded thumbnails with saved views so galleries share the same previews.
- Existing rooms, mappings and saved views remain compatible; no re-import is required.

# 0.21.0

- Make Dashboard views a dedicated room-scoped gallery with a saved-view count, Create view and Import actions, and a helpful empty state.
- Show the room canvas on this tab only when creating or editing a view. Back to views returns to the gallery and restores keyboard focus.
- Initialize camera framing after revealing the editor, so creating from a directly opened gallery works reliably.
- Keep Room & devices focused on its live room overview and device controls. Preserve existing rooms, mappings, saved views and dashboard cards without migration.

# 0.20.0

- Add Preview in dashboard to the view editor and each saved-view card. Preview current unsaved settings in the actual Home Assistant card without saving or changing a dashboard.
- Switch between desktop and phone card widths with aligned segmented controls; close the preview with the accessible close button or Escape and return to the same view.
- Add Show title on card in both view editors. New saved views hide the header by default; existing views keep their appearance until changed. Linked cards inherit the setting with per-card overrides.
- Preserve room proportions in higher-resolution thumbnails and repair older cached thumbnails when saved camera proportions are available.
- Keep existing rooms, mappings, saved views and dashboard configuration compatible. No re-upload or storage migration is required.

# 0.19.0

- Give the manager a warm Limestone & Clay identity: limestone/paper surfaces, terracotta actions, a charcoal dark palette, local serif room titles and a geometric room mark.
- Replace glowing surfaces and pill-shaped actions with quiet borders and compact rectangular buttons; unify the room stage on warm charcoal.
- Make device on/off switches slimmer with a 36 × 20 px track and 16 px thumb, retaining a 44 × 44 px touch target, keyboard support and explicit state labels.
- Preserve rooms, entity mappings, saved views and dashboard configurations; no model re-upload or storage migration required.

# 0.18.0

- Keep dashboard cards linked to their saved view. Changes saved in 3D Rooms update linked cards automatically, including exact camera framing. Generated YAML references the saved view ID.
- Add a per-field Override for this card checkbox, with an information icon explaining inheritance and overrides on hover or keyboard focus.
- Show Reset to view beside changed fields to remove that override and resume following the saved view. Numeric camera overrides retain the saved composition.
- Preserve existing standalone cards, uploaded rooms, entity mappings and saved-view storage. Select a saved view in an existing card to link it.

# 0.17.0

- Add an actual byte-based upload percentage and progress bar for room imports and replacements, with distinct processing and preparation stages.
- Simplify the room workspace: compact room navigation and device setup summary, clear Room & devices / Dashboard views / Settings tabs, and camera controls beside the model.
- Fix macro entity icons in the native Home Assistant manager: resolve the HA icon in its own document and send plain SVG data to the manager frame. This avoids cross-document stylesheet errors and preserves the entity's icon.
- Show Uploading model… and Preparing 3D view… as separate replacement stages.
- Verify the released desk model inside Home Assistant Core 2026.10.2: all eight native tests, local helper mappings and real manager replacement pass. Existing rooms and mappings remain compatible.

# 0.16.0

- Add an Adjustable desk device with one card and settings box for height, Up/Stop/Down, and four optional macros. Macro names start blank and are user editable; icons follow the mapped entities.
- Add centimetre number mappings and rest-based 3D desk motion, plus typed button/script/scene actions. Existing room mappings remain compatible.

# 0.15.0

- Restore the camera-linked navigation cube in the main room viewer and keep it visible when creating or editing saved views, including with Advanced camera settings closed.
- Make the cube smaller (72px), remove the Views picker, and add drag-to-rotate with mouse or touch. Arrow keys also rotate; clicking faces, edges or corners still snaps the view, and Home resets it. Dragging preserves camera distance, zoom and center.
- No storage, API or backend changes.

# 0.14.1

- Fix the entity list in the connect-devices dialog being clipped to about one item in the single-device dialog. The list now floats over the dialog, matches the field's width, can extend past the dialog edge, opens upward when there is no room below, and no longer makes the dialog resize or jump.
- Replace the unlabeled crosshair button with a labeled **Show in room** button, and keep the disconnect (×) button on the field. The single-device dialog now says "this device" instead of "each device".
- No storage, API or backend changes.

# 0.14.0

- Redesign the room manager with a new Slate & Teal look: soft rounded surfaces, light and dark themes that follow the system setting, and teal marking anything that is on, active or focused. Lit lights glow on their device card, and on/off is a sliding toggle.
- Add a room status strip with lights on, a "n of m connected" progress bar and a Connect devices button. Room list entries show how many devices are connected.
- Make device cards compact: colour, white temperature, effects and fade sit behind a collapsible row that remembers its state, brightness shows its percentage, and unconnected devices offer a Connect an entity button. Clicking a card highlights that device in the 3D room.
- Rooms with five or more devices get All / On / Off / Needs entity filters and a search box.
- Replace the filter input and select in the entity dialog with one searchable entity field. It suggests entities whose names match the device, shows each entity's state, can be driven from the keyboard, and disconnects with a clear button. The dialog has a fixed header and footer, device icons, and a locate button in place of Highlight. Dialogs also close when you click outside them.
- Show a Preview or Live badge next to the device count, make Preview mode a labelled switch, show a spinner while a room loads, and let toasts be dismissed with a click.
- No storage, API or backend changes; rooms, mappings and saved views are unchanged.

# 0.13.0

- Show a compact Auto / Day / Night dropdown in the corner of the rendered dashboard card for rooms with daylight windows. Choosing a mode lights the room immediately and saves it to the room's daylight settings, so other dashboards and the manager follow. Daylight-only changes update cards in place instead of reloading the 3D scene; a failed save reverts the dropdown and shows an error.

# 0.12.0

- Add a Time of day switch (Automatic, Always day, Always night) to the dashboard card editor. It saves to the room's daylight settings, so the card, other dashboards and the manager stay in sync.
- Add Replace room model in Room settings. Upload an updated room ZIP to swap the 3D model while keeping the room's ID, name, area, daylight setting, saved views and every device mapping that still matches; mappings for removed or type-changed devices are dropped and reported.

# 0.11.1

- Style room-name and other plain text/number inputs consistently with the dark form controls, with rounded borders, readable padding and a 44px minimum height. Align room-name and area-field spacing.

# 0.11.0

- Organize the manager around rooms with Devices, Saved views and Room settings tabs.
- Replace duplicate camera editors with one shared editor, basic presets and advanced precise controls. Add a clear Save view → Use in dashboard flow, with optional YAML.
- Rename rooms and link them to existing Home Assistant areas. Validate area IDs and preserve room geometry, mappings and saved views; keep area associations installation-local.
- Preserve room navigation across refreshes, protect unsaved changes and retain portable saved-view JSON compatibility.

# 0.10.1

- Add an entity-settings cog on every device card, opening a focused editor with compatible entity choices and automatic saving.
- Redesign shade actions and percentage sliders; keep controls and long entity names inside responsive cards.

# 0.10.0

- Add independent Day/Night/Auto window daylight, shade-dependent illumination, sun-entity state updates and persistent room environment settings.

# 0.9.1

- Use Home Assistant entity/state icons in dashboard circles, including custom icons and cover device classes.
- Show live On/Off, shade opening percentage and movement arrows, plus unmapped/unavailable badges. Keep badges visible near the bottom of a card.

# 0.9.0

- Add movable roller-shade imports, cover entity mappings, supported Open/Close/Stop/position commands, and opening height from Home Assistant state.
- Open native cover controls from the dashboard; retain the last visible shade height while a device is unavailable. Existing light controls and uploads stay compatible.

# 0.8.0

- Add a Home Assistant visual dashboard card editor: select a room or copy a saved component, change title, projection, rotation, tilt, zoom, height and camera interaction, and save without pasting YAML.
- Preserve existing saved camera snapshots and custom configuration while editing. Reset camera framing explicitly or when changing rooms/projections.
- Replace the hard-coded kitchen default with a choose-room prompt.

# 0.7.1

- Bundle an original teal and blue isometric room icon, with standard/high-resolution and light/dark assets for Home Assistant 2026.3 and newer.

# 0.7.0

- Allow direct orbit, pan and zoom in the component preview, synchronizing the fields and saved camera without reloading the model.
- Add a compact camera-linked view cube to both editors. Click six faces, twelve edges or eight corners; use Home to reset or the Views picker for keyboard/touch access. Fit and recenter on selection, with stable Top/Bottom orientation.

# 0.6.0

- Replace Add to dashboard's covering modal with a live component sidebar. Keep the room visible while adjusting its camera; on small screens, keep the preview above the controls.
- Add styled sliders and exact numeric inputs for rotation, tilt and zoom. Scene dragging updates the controls, and control edits update the scene immediately.
- Save a named component directly from the room view, including its exact orbit, pan, zoom and projection. Retain this framing when reopening, exporting or adding the component to a dashboard.
- Preserve existing component formats, room uploads and entity mappings. Support the full camera tilt range and responsive fitting in narrower cards.

# 0.5.0

- Add saved Home Assistant components with names, live room previews, independent rotation, tilt, zoom and card height, duplication and deletion.
- Export and import portable component settings, and copy dashboard configurations. Components share the original room model and device mappings.
- Add a compact 32 px bulb button beside each dashboard light. Click to toggle; hold to open Home Assistant more info. Keep a 44 px touch area.
- Save components in both the native integration and legacy add-on. Preserve existing models, mappings and component catalogs. Room merging remains a future feature.

# 0.4.1

Reduce model loading delays: compressed authenticated scene responses, private ETag revalidation, and a bounded session cache shared by the dashboard and model manager. Reuse concurrent downloads, invalidate after model replacement, retry failed requests, and show download/preparation progress. Preserve scene quality and existing uploads.

# 0.4.0

Consolidate model storage, upload, entity mappings, lighting controls, sidebar manager and dashboard card into a single HACS Integration. Automatically load the bundled card through Home Assistant. Add room exports carrying mappings for migration from the old add-on. Retain the add-on as a migration/development path.

# 0.3.2

Keep every wall visible from every camera angle in both the dashboard card and app viewer.

# 0.3.1

Use a front-facing perspective by default, keep the actual pendant visible in cutaway views, and open native Home Assistant controls when clicking mapped fixtures. Include keyboard access and a local light-control preview. Keep the previous floor camera available with view: floor.

# 0.3.0

Add a clean overhead floor view and a native Home Assistant dashboard card without entity icons. Keep private models in the add-on, load them with a HA Ingress session, and reflect live lighting from dashboard state. Add model-specific dashboard setup/download, camera framing and authenticated transport tests. Local generated ZIPs now save in the app project's model-exports folder.

# 0.2.0

Add capability-aware RGB color, Kelvin white temperature, device effects and fade settings. Reflect reported color in the 3D fixture and emitted light. Enforce supported features and temperature limits on the backend, preserve compatibility with existing packages, and add capability/conversion/API tests.

# 0.1.0

Initial model library, prepared ZIP/GLB imports, stable light metadata, entity mapping, preview lighting and Home Assistant WebSocket bridge. Includes Ingress packaging and persistent model storage. This is an early build pending HA OS device validation.
