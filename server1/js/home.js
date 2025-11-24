// Logic for home.html
// - Basic guard: if no token, redirect to login
// - Fetch profile to verify token and check API limits

import { requireAuth, clearToken } from "./auth.js";
import {
  backendApi,
  aiApi,
  showApiLimitWarning,
  hideApiLimitWarning,
} from "./apiClient.js";
import { base64WavToObjectUrl } from "./audio.js";
import { AUTH_STORAGE_KEYS, EVENTS, ROUTES, UI_STRINGS } from "./constants.js";

let apiUsageState = null;

requireAuth(ROUTES.LOGIN); // Check if we have *any* token?

// Listen to the header inclusion event and attach logout handler
document.addEventListener(EVENTS.INCLUDES_LOADED, async () => {
  // Attach logout handler
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
      window.location.href = ROUTES.LOGIN;
    });
  }

  // Fetch current user to validate token and display email
  try {
    const currentUser = await backendApi.currentUser();
    const currentUserInfo = currentUser.user;
    console.log(UI_STRINGS.HOME.CURRENT_USER_PREFIX, currentUser);
    const emailPlaceholder = document.getElementById("user-email-placeholder");
    if (emailPlaceholder) {
      emailPlaceholder.textContent = currentUserInfo.email;
    }
  } catch (err) {
    console.warn(UI_STRINGS.HOME.TOKEN_EXPIRED_PREFIX, err.message);
    clearToken();
    window.location.href = ROUTES.LOGIN;
  }
});

// Logout handler
async function logout() {
  try {
    await backendApi.logout?.();
  } catch (err) {
    console.warn(UI_STRINGS.HOME.LOGOUT_FAILURE_PREFIX, err.message);
  } finally {
    clearToken();
    window.location.href = ROUTES.LOGIN;
  }
}

function normalizeApiUsage(usage) {
  if (!usage) return null;
  const used = usage.used ?? usage.apiCallsUsed ?? usage.api_calls_used;
  const limit =
    usage.limit ?? usage.apiCallsLimit ?? usage.api_calls_limit ?? 20;

  if (used === undefined && limit === undefined) return null;

  const usedNumber = Number.isFinite(Number(used)) ? Number(used) : 0;
  const limitNumber = Number.isFinite(Number(limit)) ? Number(limit) : 20;

  return {
    used: usedNumber,
    limit: limitNumber,
    remaining: Math.max(limitNumber - usedNumber, 0),
    limitExceeded:
      usage.limitExceeded ??
      usage.apiLimitExceeded ??
      usedNumber >= limitNumber,
  };
}

function renderApiUsageBanner(rawUsage) {
  const usage = normalizeApiUsage(rawUsage ?? apiUsageState);
  apiUsageState = usage;

  const usageContainer = document.getElementById("api-usage-container");
  const usageText = document.getElementById("api-usage-text");
  const submitButton = document.getElementById("create-speech-button");

  const limitReached =
    usage?.limitExceeded || (usage?.remaining ?? 1) <= 0;

  if (!usageContainer || !usageText) return usage;

  if (!usage) {
    usageContainer.classList.add("hidden");
    submitButton?.removeAttribute("disabled");
    submitButton?.classList.remove("cursor-not-allowed", "opacity-50");
    hideApiLimitWarning();
    return usage;
  }

  usageContainer.classList.remove("hidden");
  usageText.textContent = UI_STRINGS.HOME.API_USAGE_TEXT(usage);

  submitButton?.removeAttribute("disabled");
  submitButton?.classList.remove("cursor-not-allowed", "opacity-50");

  if (limitReached) showApiLimitWarning();
  else hideApiLimitWarning();

  return usage;
}

// Check user status and API limits on page load
document.addEventListener("DOMContentLoaded", async () => {
  await checkCurrentUser();
  initializeTextToSpeechForm();
});

async function checkCurrentUser() {
  try {
    const currentUser = await backendApi.currentUser();
    const usage = renderApiUsageBanner(currentUser.user);
    const limitReached =
      currentUser.user?.apiLimitExceeded ||
      usage?.limitExceeded ||
      (usage?.remaining ?? 1) <= 0;
    if (
      currentUser.success &&
      currentUser.user &&
      limitReached
    ) {
      showApiLimitWarning();
    } else {
      hideApiLimitWarning();
    }
  } catch (err) {
    console.warn(UI_STRINGS.HOME.FETCH_USER_FAILURE_PREFIX, err);
  }
}

function initializeTextToSpeechForm() {
  const form = document.getElementById("text-to-speech-form");
  const languageSelect = document.getElementById("language");
  const textInput = document.getElementById("text-to-convert");
  const submitButton = document.getElementById("create-speech-button");
  const audioCard = document.getElementById("audio-card");
  const audioControls = document.getElementById("audio-player-controls");
  const audioStatus = document.getElementById("audio-status");
  const downloadLink = document.getElementById("download-link");

  // Re-render usage banner now that DOM refs exist
  renderApiUsageBanner();

  if (
    !form ||
    !languageSelect ||
    !textInput ||
    !submitButton ||
    !audioCard ||
    !audioControls ||
    !audioStatus ||
    !downloadLink
  ) {
    console.error(UI_STRINGS.HOME.MISSING_DOM);
    return;
  }

  const DISABLED_CLASSES = [
    "opacity-50",
    "cursor-not-allowed",
    "bg-gray-100",
    "dark:bg-gray-800",
    "border-gray-300",
    "dark:border-gray-700",
    "text-gray-500",
    "dark:text-gray-400",
  ];
  const ENABLED_CLASSES = [
    "bg-sky-50",
    "dark:bg-sky-900/50",
    "border-sky-500",
    "dark:border-sky-400",
    "text-sky-700",
    "dark:text-sky-300",
  ];

  let currentObjectUrl = null;

  function resetCardClasses() {
    audioCard.classList.remove(
      ...DISABLED_CLASSES,
      ...ENABLED_CLASSES,
      "border-red-500",
      "dark:border-red-400",
      "bg-red-50",
      "dark:bg-red-900/40"
    );
    audioStatus.classList.remove(
      "text-gray-500",
      "dark:text-gray-400",
      "text-sky-700",
      "dark:text-sky-300",
      "text-red-600",
      "dark:text-red-300"
    );
  }

  function setAudioPlayerState(
    state,
    { audioUrl, message, downloadName } = {}
  ) {
    resetCardClasses();
    downloadLink.classList.add("hidden");

    switch (state) {
      case "ready": {
        audioControls.disabled = false;
        if (audioUrl) {
          audioControls.src = audioUrl;
        }
        audioControls.load();
        audioCard.classList.add(...ENABLED_CLASSES);
        audioStatus.classList.add("text-sky-700", "dark:text-sky-300");
        audioStatus.textContent =
          message || UI_STRINGS.HOME.PLAYER_READY;
        if (audioUrl) {
          downloadLink.href = audioUrl;
          downloadLink.download =
            downloadName || UI_STRINGS.HOME.DOWNLOAD_FALLBACK;
          downloadLink.classList.remove("hidden");
        }
        break;
      }
      case "loading": {
        audioControls.disabled = true;
        audioControls.removeAttribute("src");
        audioControls.load();
        audioCard.classList.add(...DISABLED_CLASSES);
        audioStatus.classList.add("text-gray-500", "dark:text-gray-400");
        audioStatus.textContent =
          message || UI_STRINGS.HOME.PLAYER_LOADING;
        break;
      }
      case "error": {
        audioControls.disabled = true;
        audioControls.removeAttribute("src");
        audioControls.load();
        audioCard.classList.add(
          ...DISABLED_CLASSES,
          "border-red-500",
          "dark:border-red-400",
          "bg-red-50",
          "dark:bg-red-900/40"
        );
        audioStatus.classList.add("text-red-600", "dark:text-red-300");
        audioStatus.textContent =
          message || UI_STRINGS.HOME.PLAYER_ERROR;
        break;
      }
      case "disabled":
      default: {
        audioControls.disabled = true;
        audioControls.removeAttribute("src");
        audioControls.load();
        audioCard.classList.add(...DISABLED_CLASSES);
        audioStatus.classList.add("text-gray-500", "dark:text-gray-400");
        audioStatus.textContent =
          message || UI_STRINGS.HOME.PLAYER_DISABLED;
        break;
      }
    }
  }

  function revokeCurrentUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  }

  setAudioPlayerState("disabled");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = textInput.value.trim();
    const language = languageSelect.value.trim().toLowerCase();
    const limitReached =
      apiUsageState?.limitExceeded ||
      (apiUsageState?.remaining !== undefined &&
        apiUsageState.remaining <= 0);

    if (!text) {
      setAudioPlayerState("error", {
        message: UI_STRINGS.HOME.ENTER_TEXT,
      });
      return;
    }

    if (limitReached) {
      showApiLimitWarning(UI_STRINGS.HOME.API_LIMIT_REACHED);
      const proceed = window.confirm(UI_STRINGS.HOME.API_LIMIT_CONFIRM);
      if (!proceed) {
        setAudioPlayerState("error", {
          message: UI_STRINGS.HOME.API_LIMIT_REACHED,
        });
        return;
      }
    }

    submitButton.disabled = true;
    submitButton.textContent = UI_STRINGS.HOME.BUTTON_GENERATING;
    setAudioPlayerState("loading");

    try {
      const response = await aiApi.synthesizeSpeech({
        text,
        language,
        speakerId: "default",
      });

      const {
        audio_base64: audioBase64,
        duration_seconds: durationSeconds,
        sample_rate: sampleRate,
        apiUsage,
      } = response;

      if (apiUsage) {
        renderApiUsageBanner(apiUsage);
      }

      if (!audioBase64) {
        throw new Error(UI_STRINGS.HOME.MISSING_AUDIO_DATA);
      }

      const { objectUrl } = base64WavToObjectUrl(audioBase64);
      revokeCurrentUrl();
      currentObjectUrl = objectUrl;

      setAudioPlayerState("ready", {
        audioUrl: objectUrl,
        message: UI_STRINGS.HOME.PLAYER_READY,
        downloadName: `tts-${Date.now()}.wav`,
      });
    } catch (error) {
      console.error(UI_STRINGS.HOME.SYNTHESIS_FAILURE_PREFIX, error);
      const message =
        error?.message || UI_STRINGS.HOME.PLAYER_ERROR;
      setAudioPlayerState("error", { message });
      if (error?.data?.apiUsage) {
        renderApiUsageBanner(error.data.apiUsage);
      }
      if (error?.status === 429) {
        showApiLimitWarning();
      }
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("cursor-not-allowed", "opacity-50");
      submitButton.textContent = UI_STRINGS.HOME.BUTTON_DEFAULT;
    }
  });
  window.addEventListener("beforeunload", () => {
    revokeCurrentUrl();
  });
}
