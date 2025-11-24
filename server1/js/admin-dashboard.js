import { adminApi } from "./admin-api.js";
import {
  clearAdminSession,
  requireAdminAuth,
} from "./admin-auth.js";
import { ADMIN_ROUTES, UI_STRINGS } from "./constants.js";

requireAdminAuth(ADMIN_ROUTES.LOGIN);

const statusDiv = document.getElementById("dashboard-status");
const adminEmailDisplay = document.getElementById("admin-email-display");
const usersTableBody = document.getElementById("users-table-body");
const endpointStatsBody = document.getElementById("endpoint-stats-body");

const createAdminForm = document.getElementById("create-admin-form");
const newAdminEmailInput = document.getElementById("new-admin-email");
const newAdminPasswordInput = document.getElementById("new-admin-password");
const createAdminMessage = document.getElementById("create-admin-message");
const createAdminButton = document.getElementById("create-admin-btn");

function setStatus(message, type = "info") {
  if (!statusDiv) return;
  if (!message) {
    statusDiv.className = "hidden";
    statusDiv.innerHTML = "";
    return;
  }

  const styles = {
    info: "text-sky-700 bg-sky-50 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-200",
    success:
      "text-green-700 bg-green-50 border border-green-200 dark:bg-green-900/40 dark:text-green-200",
    error:
      "text-red-700 bg-red-50 border border-red-200 dark:bg-red-900/40 dark:text-red-200",
  };

  statusDiv.className = `p-3 rounded ${styles[type] || styles.info}`;
  statusDiv.innerHTML = message;
}

function renderAdminInfo(admin) {
  if (adminEmailDisplay && admin?.email) {
    adminEmailDisplay.textContent = admin.email;
  }
}

function createActionButton(label, className, handler) {
  const button = document.createElement("button");
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function renderUsers(users, currentAdminId) {
  if (!usersTableBody) return;
  usersTableBody.innerHTML = "";

  if (!users || users.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="4" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No users found.</td>';
    usersTableBody.appendChild(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");
    row.className =
      "bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600";

    const emailCell = document.createElement("th");
    emailCell.scope = "row";
    emailCell.className =
      "px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white";
    emailCell.textContent = user.email;

    const adminCell = document.createElement("td");
    adminCell.className = "px-6 py-4 text-center";
    adminCell.innerHTML = user.is_admin
      ? `<svg class="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
      : `<svg class="w-5 h-5 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;

    const usageCell = document.createElement("td");
    usageCell.className =
      "px-6 py-4 text-right font-semibold text-gray-900 dark:text-white";
    usageCell.innerHTML = `
      <span>${user.api_calls_used ?? 0}</span>
      <span class="mx-1">/</span>
      <span>${user.api_calls_limit ?? 0}</span>
    `;

    const actionsCell = document.createElement("td");
    actionsCell.className = "px-6 py-4 text-center";

    if (user.user_id === currentAdminId) {
      const span = document.createElement("span");
      span.className = "text-gray-500 italic";
      span.textContent = "Current Admin";
      actionsCell.appendChild(span);
    } else if (user.is_admin) {
      const resetBtn = createActionButton(
        "Reset Usage",
        "text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
        () => handleResetUsage(user.user_id)
      );
      actionsCell.appendChild(resetBtn);

      const adminLabel = document.createElement("span");
      adminLabel.className = "text-gray-500 italic ml-2";
      adminLabel.textContent = "Admin User";
      actionsCell.appendChild(adminLabel);
    } else {
      const deleteBtn = createActionButton(
        "Delete",
        "text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800 mr-2",
        () => handleDelete(user.user_id)
      );

      const resetBtn = createActionButton(
        "Reset Usage",
        "text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-3 py-2 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
        () => handleResetUsage(user.user_id)
      );

      actionsCell.append(deleteBtn, resetBtn);
    }

    row.append(emailCell, adminCell, usageCell, actionsCell);
    usersTableBody.appendChild(row);
  });
}

function renderEndpointStats(stats) {
  if (!endpointStatsBody) return;
  endpointStatsBody.innerHTML = "";

  if (!stats || stats.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="4" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No API usage data available yet.</td>';
    endpointStatsBody.appendChild(row);
    return;
  }

  stats.forEach((stat) => {
    const row = document.createElement("tr");
    row.className =
      "bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600";

    const methodCell = document.createElement("td");
    methodCell.className = "px-6 py-4 font-medium";
    methodCell.innerHTML = `<span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded text-xs font-semibold">${stat.method}</span>`;

    const endpointCell = document.createElement("td");
    endpointCell.className = "px-6 py-4 font-mono text-sm";
    endpointCell.textContent = stat.endpoint;

    const requestCountCell = document.createElement("td");
    requestCountCell.className =
      "px-6 py-4 font-semibold text-gray-900 dark:text-white";
    requestCountCell.textContent = stat.request_count;

    const lastCalledCell = document.createElement("td");
    lastCalledCell.className = "px-6 py-4 text-sm text-gray-600 dark:text-gray-300";
    lastCalledCell.textContent =
      stat.last_called_formatted || stat.last_called || "—";

    row.append(methodCell, endpointCell, requestCountCell, lastCalledCell);
    endpointStatsBody.appendChild(row);
  });
}

async function loadDashboard() {
  setStatus("Loading admin dashboard...", "info");
  try {
    const data = await adminApi.dashboard();
    renderAdminInfo(data.admin);
    renderUsers(data.users, data.admin?.userId);
    renderEndpointStats(data.endpointStats);
    setStatus("");
  } catch (error) {
    setStatus(
      `${UI_STRINGS.ADMIN.DASHBOARD.LOAD_ERROR_PREFIX} ${error.message}`,
      "error"
    );
  }
}

async function handleDelete(userId) {
  const confirmed = confirm(
    "Are you sure you want to delete this user? This action cannot be undone."
  );
  if (!confirmed) return;

  setStatus("Deleting user...", "info");
  try {
    await adminApi.deleteUser(userId);
    setStatus(UI_STRINGS.ADMIN.DASHBOARD.DELETE_SUCCESS, "success");
    await loadDashboard();
  } catch (error) {
    setStatus(error.message || "Failed to delete user.", "error");
  }
}

async function handleResetUsage(userId) {
  const confirmed = confirm("Reset API usage for this user?");
  if (!confirmed) return;

  setStatus("Resetting usage...", "info");
  try {
    await adminApi.resetUsage(userId);
    setStatus(UI_STRINGS.ADMIN.DASHBOARD.RESET_SUCCESS, "success");
    await loadDashboard();
  } catch (error) {
    setStatus(error.message || "Failed to reset usage.", "error");
  }
}

async function handleLogout() {
  try {
    await adminApi.logout();
  } catch (_) {
    // Ignore errors during logout; proceed to clear session.
  } finally {
    clearAdminSession();
    window.location.href = ADMIN_ROUTES.LOGIN;
  }
}

function wireLogoutButton() {
  const logoutBtn = document.getElementById("admin-logout-btn");
  logoutBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    handleLogout();
  });
}

function wireCreateAdminForm() {
  if (!createAdminForm) return;

  createAdminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (createAdminButton) createAdminButton.disabled = true;
    createAdminMessage.textContent = "";

    try {
      const email = newAdminEmailInput.value.trim();
      const password = newAdminPasswordInput.value;

      await adminApi.addAdmin(email, password);
      createAdminMessage.className =
        "text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2";
      createAdminMessage.textContent =
        UI_STRINGS.ADMIN.DASHBOARD.CREATE_ADMIN_SUCCESS;

      newAdminEmailInput.value = "";
      newAdminPasswordInput.value = "";
      await loadDashboard();
    } catch (error) {
      createAdminMessage.className =
        "text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2";
      createAdminMessage.textContent = error.message || "Failed to add admin.";
    } finally {
      if (createAdminButton) createAdminButton.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireLogoutButton();
  wireCreateAdminForm();
  loadDashboard();
});
