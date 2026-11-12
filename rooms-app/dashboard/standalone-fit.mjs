/**
 * Height for the full-screen page. An iOS home-screen app that draws under
 * the status bar reports a viewport (innerHeight, 100vh, 100dvh) short by the
 * top safe-area inset, leaving an empty band at the bottom. When adding that
 * inset gives exactly the screen's height, the inset was missing: use it.
 * Anything else (browser tabs, split view, a correct viewport) is left as is.
 */
export function pageHeight({
  standalone,
  innerWidth,
  innerHeight,
  screenWidth,
  screenHeight,
  insetTop,
}) {
  if (!standalone || !(insetTop > 0)) return innerHeight;
  const long = Math.max(screenWidth, screenHeight),
    short = Math.min(screenWidth, screenHeight);
  const screenTall = innerHeight >= innerWidth ? long : short;
  return Math.abs(innerHeight + insetTop - screenTall) <= 2
    ? innerHeight + insetTop
    : innerHeight;
}

/** Keep `--three-d-rooms-page-height` on <html> matched to the real screen. */
export function fitPage(win = window) {
  const doc = win.document,
    probe = doc.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  doc.documentElement.append(probe);
  const update = () => {
    const height = pageHeight({
      standalone:
        win.navigator.standalone === true ||
        win.matchMedia?.("(display-mode: standalone)").matches === true,
      innerWidth: win.innerWidth,
      innerHeight: win.innerHeight,
      screenWidth: win.screen.width,
      screenHeight: win.screen.height,
      insetTop: probe.getBoundingClientRect().height,
    });
    doc.documentElement.style.setProperty(
      "--three-d-rooms-page-height",
      `${Math.round(height)}px`,
    );
  };
  update();
  win.addEventListener("resize", update);
  win.addEventListener("orientationchange", () => setTimeout(update, 250));
  win.visualViewport?.addEventListener("resize", update);
  return update;
}
