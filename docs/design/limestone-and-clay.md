# 3D Rooms: Limestone & Clay

A calm architectural workspace with warm neutrals and clay actions. Introduced in 0.19.0.

- Light: limestone #f4f1eb, paper #fffcf7, charcoal text #292723, clay #a34830 with white button text.
- Dark: charcoal #1b1a18, warm surfaces #24221f, ivory text #f4efe6, pale clay #edac8c with dark button text #302018.
- Use semantic CSS tokens in web/style.css. Keep device labels and pressed/checked states explicit; color alone never identifies state.
- System sans-serif for controls; locally available Iowan/Palatino/Georgia for the room title. No external font downloads.
- Compact rectangular buttons, 6/10/12 px corner scale, solid surfaces, quiet borders, underline workspace tabs. Avoid neon, cool blue gradients, glowing surfaces and pill navigation.
- Keep the 3D stage warm charcoal (#242320) in both themes so existing room lighting and materials retain their appearance. No lighting, geometry, camera or storage changes.
- Retain keyboard focus, 44 px main action targets, existing reduced-motion support and responsive layouts.

Applied the ui-ux-pro-max Minimalism & Swiss Style match (architectural minimal warm): clear hierarchy, functional spacing, simple borders, restrained motion. The broad smart-home system search recommended glassmorphism and a cool slate palette; those were rejected because they overlap the supplied reference. Palette and serif heading are project-specific design decisions.
