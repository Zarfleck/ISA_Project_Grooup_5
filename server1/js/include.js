document.addEventListener("DOMContentLoaded", async () => {
  const includeTargets = document.querySelectorAll("[data-include]");

  // Load all includes in parallel and wait for completion
  const tasks = Array.from(includeTargets).map(async (element) => {
    const src = element.getAttribute("data-include");
    if (!src) return;
    try {
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      element.innerHTML = html;
    } catch (err) {
      console.error("Failed to include", src, err);
      element.innerHTML = "";
    }
  });

  // Wait until includes are done
  await Promise.all(tasks);

  document.dispatchEvent(new Event("includesLoaded"));
});
