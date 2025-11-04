// Logic for login.html
// - Intercepts form submit and login button click
// - Calls placeholder /auth/login endpoint
// - Stores token and redirects to home.html

import { api } from "./apiClient.js";
import { setToken, redirectIfAuthenticated } from "./auth.js";

// If user is already logged in, skip the page
redirectIfAuthenticated("home.html");

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

    messageDiv.innerHTML = `<div class="p-2 text-sm text-sky-500 dark:text-sky-400 rounded-lg">Logging in...</div>`;

    try {
      // Call placeholder login endpoint
      const respond = await api.login(email, password);

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
      console.error("Login error:", error);
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
