import { EVENTS, INCLUDE_SELECTORS, UI_STRINGS } from "./constants.js";

document.addEventListener("DOMContentLoaded", async () => {
  const includeTargets = document.querySelectorAll(INCLUDE_SELECTORS.TARGET);

  // Load all includes in parallel and wait for completion
  const tasks = Array.from(includeTargets).map(async (element) => {
    const src = element.getAttribute(INCLUDE_SELECTORS.ATTRIBUTE);
    if (!src) return;
    try {
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`${UI_STRINGS.INCLUDE.HTTP_STATUS_LABEL} ${res.status}`);
      }
      const html = await res.text();
      element.innerHTML = html;
    } catch (err) {
      console.error(UI_STRINGS.INCLUDE.FETCH_FAILURE_PREFIX, src, err);
      element.innerHTML = "";
    }
  });

  // Wait until includes are done
  await Promise.all(tasks);

  document.dispatchEvent(new Event(EVENTS.INCLUDES_LOADED));
});
