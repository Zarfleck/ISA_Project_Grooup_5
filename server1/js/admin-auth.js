import {
  ADMIN_ROUTES,
  AUTH_SESSION_ACTIVE_VALUE,
  AUTH_STORAGE_KEYS,
} from "./constants.js";

const { ADMIN_SESSION } = AUTH_STORAGE_KEYS;

export function setAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION, AUTH_SESSION_ACTIVE_VALUE);
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION);
}

export function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION) === AUTH_SESSION_ACTIVE_VALUE;
}

export function requireAdminAuth(redirectTo = ADMIN_ROUTES.LOGIN) {
  if (!isAdminAuthenticated()) {
    window.location.href = redirectTo;
  }
}

export function redirectIfAdminAuthenticated(target = ADMIN_ROUTES.DASHBOARD) {
  if (isAdminAuthenticated()) {
    window.location.href = target;
  }
}
