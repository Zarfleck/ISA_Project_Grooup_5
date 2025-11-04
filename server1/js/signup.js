// Logic for signup.html
// - Intercepts form submit
// - Calls placeholder /auth/signup endpoint
// - Stores token and redirects to home.html

import { api } from "./apiClient.js";
import { setToken, redirectIfAuthenticated } from "./auth.js";

redirectIfAuthenticated("home.html");

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
    messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">Passwords do not match.</div>`;
    return;
  }

  messageDiv.innerHTML = `<div class="p-2 text-sm text-sky-500 dark:text-sky-400 rounded-lg">Registering...</div>`;

  if (submitBtn) submitBtn.disabled = true;
  try {
    const respond = await api.signup(email, password);
    if (respond.success) {
      const token = respond.token || respond.data?.token;
      setToken(token);
      messageDiv.innerHTML = `<div class="p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900 dark:text-green-400 rounded-lg" role="alert">Success! ${respond.message}</div>`;
      setTimeout(() => {
        window.location.href = "/views/home.html?authenticated=true";
      }, 2000);
    } else {
      messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">Error: ${respond.message}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = `<div class="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-400 rounded-lg" role="alert">Network error: Could not connect to the server.</div>`;
    console.error("Registration error:", error);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});
