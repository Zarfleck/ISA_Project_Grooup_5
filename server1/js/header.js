// Header functionality - logout button and user email display
import { logout } from "./auth.js";
import { api } from "./apiClient.js";
import { UI_STRINGS } from "./constants.js";

function initHeader() {
  // Setup logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn && !logoutBtn.dataset.initialized) {
    logoutBtn.dataset.initialized = "true";
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Load and display user email
  const emailPlaceholder = document.getElementById("user-email-placeholder");
  if (emailPlaceholder && !emailPlaceholder.dataset.loaded) {
    emailPlaceholder.dataset.loaded = "true";
    api
      .currentUser()
      .then((response) => {
        if (response.success && response.user) {
          emailPlaceholder.textContent =
            response.user.email || UI_STRINGS.HEADER.FALLBACK_USER;
        }
      })
      .catch((error) => {
        console.warn(UI_STRINGS.HEADER.LOAD_ERROR_PREFIX, error);
        // Keep default "Email" text if fetch fails
      });
  }
}

// Try to initialize immediately (in case DOM is already loaded)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHeader);
} else {
  // DOM is already loaded, initialize immediately
  initHeader();
}

// Also listen for header insertion (when included dynamically)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1 && (node.id === "logout-btn" || node.querySelector?.("#logout-btn"))) {
        initHeader();
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Call initHeader once more after a short delay to catch dynamically loaded content
setTimeout(initHeader, 100);

