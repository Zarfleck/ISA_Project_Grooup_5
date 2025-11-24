// Logic for signup.html
// - Intercepts form submit
// - Calls placeholder /auth/signup endpoint
// - Stores token and redirects to home.html

import { backendApi } from "./apiClient.js";
import { setToken, redirectIfAuthenticated } from "./auth.js";
import { ROUTES, UI_STRINGS } from "./constants.js";

redirectIfAuthenticated(ROUTES.HOME);

const signupForm = document.getElementById("signup-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm-password");
const submitBtn = document.getElementById("signup-btn");
const messageDiv = document.getElementById("message");

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (password !== confirm) {
    messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${UI_STRINGS.SIGNUP.PASSWORD_MISMATCH}</div>`;
    return;
  }

  messageDiv.innerHTML = `<div class="p-2 text-sm text-sky-500 dark:text-sky-400 rounded-lg">${UI_STRINGS.SIGNUP.REGISTERING}</div>`;

  if (submitBtn) submitBtn.disabled = true;
  try {
    const respond = await backendApi.signup(email, password);
    if (respond.success) {
      const token = respond.token || respond.data?.token;
      setToken(token);
      messageDiv.innerHTML = `<div class="p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-400 rounded-lg" role="alert">${UI_STRINGS.SIGNUP.SUCCESS_PREFIX} ${respond.message}</div>`;
      setTimeout(() => {
        window.location.href = ROUTES.HOME_AUTHENTICATED;
      }, 2000);
    } else {
      messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${UI_STRINGS.SIGNUP.ERROR_PREFIX} ${respond.message}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${error}</div>`;
    console.error(UI_STRINGS.SIGNUP.ERROR_LOG_PREFIX, error);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});
