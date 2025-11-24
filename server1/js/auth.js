// Auth token management and simple guards

import {
  AUTH_SESSION_ACTIVE_VALUE,
  AUTH_STORAGE_KEYS,
  ROUTES,
} from "./constants.js";

const {
  TOKEN: TOKEN_KEY,
  EMAIL: EMAIL_KEY, // Used through the password reset flow
  RESET_CODE: RESET_CODE_KEY,
  SESSION_FLAG: SESSION_FLAG_KEY,
} = AUTH_STORAGE_KEYS;

// get/set/clear auth session flag (JWT stays in httpOnly cookie; do not store tokens client-side)
export function setToken(token) {
  localStorage.removeItem(TOKEN_KEY); // ensure legacy token is cleared
  sessionStorage.setItem(SESSION_FLAG_KEY, AUTH_SESSION_ACTIVE_VALUE);
}

export function getToken() {
  // JWT is stored as httpOnly cookie; do not expose to JS
  return null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_FLAG_KEY);
}

// Check if user is authenticated
export function isAuthenticated() {
  return (
    sessionStorage.getItem(SESSION_FLAG_KEY) === AUTH_SESSION_ACTIVE_VALUE
  );
}

// Save/get email used in password reset flow
export function saveEmailForReset(email) {
  sessionStorage.setItem(EMAIL_KEY, email);
}

export function getSavedEmailForReset() {
  return sessionStorage.getItem(EMAIL_KEY);
}

// Save/get reset code used in password reset flow
export function saveResetCode(code) {
  sessionStorage.setItem(RESET_CODE_KEY, code);
}

export function getSavedResetCode() {
  return sessionStorage.getItem(RESET_CODE_KEY);
}

// Clear email and code from session storage
export function clearResetFlow() {
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(RESET_CODE_KEY);
}

// Redirect to login if not authenticated
export function requireAuth(redirectTo = ROUTES.LOGIN) {
  if (!isAuthenticated()) {
    window.location.href = redirectTo;
  }
}

// If user already logged in, navigate to home
export function redirectIfAuthenticated(target = ROUTES.HOME) {
  if (isAuthenticated()) {
    window.location.href = target;
  }
}
