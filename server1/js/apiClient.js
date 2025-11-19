// Uses fetch with JSON, attaches token if present

import { AI_SERVER_URL, BACKEND_SERVER_URL, UI_STRINGS } from "./constants.js";
import { getToken, clearToken } from "./auth.js";

// Global function to show API limit warning (can be called from anywhere)
export function showApiLimitWarning(message) {
  const warningDiv = document.getElementById("api-limit-warning");
  if (warningDiv) {
    warningDiv.classList.remove("hidden");
    warningDiv.innerHTML = `
      <div class="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-4 rounded" role="alert">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium">${
              message || UI_STRINGS.API_LIMIT_WARNING
            }</p>
          </div>
        </div>
      </div>
    `;
  }
}

export function hideApiLimitWarning() {
  const warningDiv = document.getElementById("api-limit-warning");
  if (warningDiv) {
    warningDiv.classList.add("hidden");
  }
}

// Make it available globally for backwards compatibility
if (typeof window !== "undefined") {
  window.showApiLimitWarning = showApiLimitWarning;
  window.hideApiLimitWarning = hideApiLimitWarning;
}

async function makeRequest(
  path,
  {
    method = "GET",
    baseUrl = BACKEND_SERVER_URL,
    body,
    auth = false,
    credentials = "include",
  } = {}
) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`; // Attach JWT if available
  }

  const respond = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: credentials,
  });

  if (respond.status === 401 && auth) {
    clearToken();
    window.location.href = "/views/login.html";
    return;
  }

  // Attempt JSON; if it fails, create a uniform error
  let data;
  try {
    data = await respond.json();
  } catch (_) {
    data = { success: respond.ok };
  }

  if (!respond.ok) {
    const message = data?.message || `Request failed (${respond.status})`;
    const error = new Error(message);
    error.status = respond.status;
    error.data = data;
    throw error;
  }

  // Check for API limit warning and show it
  if (data.user?.apiLimitExceeded) {
    showApiLimitWarning();
  }

  return data;
}

// Temporary endpoints in one place for easy use
export const backendApi = {
  login: (email, password) =>
    makeRequest("/auth/login", { method: "POST", body: { email, password } }),

  signup: (email, password) =>
    makeRequest("/auth/signup", { method: "POST", body: { email, password } }),

  currentUser: () => makeRequest("/auth/me", { method: "GET", auth: true }),

  logout: () =>
    makeRequest("/auth/logout", { method: "POST", credentials: "include" }),

  incrementApiUsage: () =>
    makeRequest("/usage/increment", { method: "POST", auth: true }),

  // requestPasswordReset: (email) =>
  //   makeRequest("/auth/password/request", { method: "POST", body: { email } }),

  // Routes for password reset flow (not implemented yet)
  // verifyResetCode: (email, code) =>
  //   makeRequest("/auth/password/verify", {
  //     method: "POST",
  //     body: { email, code },
  //   }),

  // resetPassword: (email, code, password) =>
  //   makeRequest("/auth/password/reset", {
  //     method: "POST",
  //     body: { email, code, password },
  //   }),
};

export const aiApi = {
  synthesizeSpeech: ({ text, language, speakerId, speakerWavBase64 }) => {
    if (!text) {
      throw new Error("Text is required when requesting speech synthesis.");
    }

    const payload = {
      text,
      ...(language ? { language } : {}),
      // API expects snake_case keys; omit undefined optional values
      ...(speakerId ? { speaker_id: speakerId } : {}),
      ...(speakerWavBase64 ? { speaker_wav_base64: speakerWavBase64 } : {}),
    };

    return makeRequest("/synthesize", {
      method: "POST",
      body: payload,
      baseUrl: AI_SERVER_URL,
      auth: true,
    });
  },
};
