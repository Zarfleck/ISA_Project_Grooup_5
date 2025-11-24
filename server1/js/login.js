// Logic for login.html
// - Intercepts form submit and login button click
// - Calls placeholder /auth/login endpoint
// - Stores token and redirects to home.html

import { backendApi } from "./apiClient.js";
import { setToken, redirectIfAuthenticated } from "./auth.js";
import { ROUTES, UI_STRINGS } from "./constants.js";

// If user is already logged in, skip the page
redirectIfAuthenticated(ROUTES.HOME);

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("login-btn");
const messageDiv = document.getElementById("message");

async function handleLogin() {
  if (submitBtn) submitBtn.disabled = true;
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    messageDiv.innerHTML = `<div class="p-2 text-sm text-sky-500 dark:text-sky-400 rounded-lg">${UI_STRINGS.LOGIN.LOGGING_IN}</div>`;

    try {
      // Call placeholder login endpoint
      const respond = await backendApi.login(email, password);

      if (respond.success) {
        const token = respond.token || respond.data?.token;
        setToken(token);

        messageDiv.innerHTML = `<div class="p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-400 rounded-lg" role="alert">${UI_STRINGS.LOGIN.SUCCESS_PREFIX} ${respond.message}</div>`;

        setTimeout(() => {
          window.location.href = ROUTES.HOME_AUTHENTICATED;
        }, 2000);
      } else {
        messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${UI_STRINGS.LOGIN.ERROR_PREFIX} ${respond.message}</div>`;
      }
    } catch (error) {
      messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${error}</div>`;
      console.error(UI_STRINGS.LOGIN.ERROR_LOG_PREFIX, error);
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Prevent inline onclick navigation when we handle click
submitBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();
  handleLogin();
});

// Also handle full form submit (e.g., Enter key)
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  handleLogin();
});
