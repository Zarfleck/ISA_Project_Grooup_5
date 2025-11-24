import {
  ADMIN_ROUTES,
  ADMIN_SERVER_URL,
  UI_STRINGS,
} from "./constants.js";
import { clearAdminSession } from "./admin-auth.js";

async function makeAdminRequest(
  path,
  { method = "GET", body, auth = true } = {}
) {
  const headers = { "Content-Type": "application/json" };

  const response = await fetch(`${ADMIN_SERVER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    data = { success: response.ok };
  }

  if (response.status === 401 && auth) {
    clearAdminSession();
    const onLoginPage = window.location.href.includes(ADMIN_ROUTES.LOGIN);
    if (!onLoginPage) {
      window.location.href = ADMIN_ROUTES.LOGIN;
    }
    const error = new Error(
      data?.message || UI_STRINGS.ADMIN.AUTH_REQUIRED || "Unauthorized"
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (!response.ok) {
    const message =
      data?.message || UI_STRINGS.API_CLIENT.REQUEST_FAILED(response.status);
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const adminApi = {
  login: (email, password) =>
    makeAdminRequest("/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  logout: () => makeAdminRequest("/logout", { method: "GET" }),
  dashboard: () => makeAdminRequest("/dashboard"),
  deleteUser: (userId) =>
    makeAdminRequest(`/users/${userId}`, { method: "DELETE" }),
  resetUsage: (userId) =>
    makeAdminRequest(`/users/${userId}/reset-usage`, { method: "PATCH" }),
  addAdmin: (email, password) =>
    makeAdminRequest("/add-admin", {
      method: "POST",
      body: { email, password },
    }),
};
