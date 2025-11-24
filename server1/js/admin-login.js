import { adminApi } from "./admin-api.js";
import {
  redirectIfAdminAuthenticated,
  setAdminSession,
} from "./admin-auth.js";
import { ADMIN_ROUTES, UI_STRINGS } from "./constants.js";

redirectIfAdminAuthenticated(ADMIN_ROUTES.DASHBOARD);

const loginForm = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const submitBtn = document.getElementById("admin-login-btn");
const messageDiv = document.getElementById("admin-message");

async function handleLogin() {
  if (submitBtn) submitBtn.disabled = true;
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    messageDiv.innerHTML = `<div class="p-2 text-sm text-sky-500 dark:text-sky-400 rounded-lg">${UI_STRINGS.ADMIN.LOGIN.LOGGING_IN}</div>`;

    const respond = await adminApi.login(email, password);

    if (respond.success) {
      setAdminSession();
      messageDiv.innerHTML = `<div class="p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-400 rounded-lg" role="alert">${UI_STRINGS.ADMIN.LOGIN.SUCCESS_PREFIX} ${respond.message}</div>`;

      setTimeout(() => {
        window.location.href = ADMIN_ROUTES.DASHBOARD;
      }, 1200);
    } else {
      messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${UI_STRINGS.ADMIN.LOGIN.ERROR_PREFIX} ${
        respond.message || "Login failed."
      }</div>`;
    }
  } catch (error) {
    const errorMessage = error?.message || "Admin login failed.";
    messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">${UI_STRINGS.ADMIN.LOGIN.ERROR_PREFIX} ${errorMessage}</div>`;
    console.error("Admin login error:", error);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

submitBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();
  handleLogin();
});

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  handleLogin();
});
