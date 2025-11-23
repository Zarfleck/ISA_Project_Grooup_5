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

let apiUsageState = null;

requireAuth("login.html"); // Check if we have *any* token?

// Listen to the header inclusion event and attach logout handler
document.addEventListener("includesLoaded", async () => {
  // Attach logout handler
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
      localStorage.removeItem("auth_token");
      window.location.href = "/views/login.html";
    });
  }

  // Fetch current user to validate token and display email
  try {
    const currentUser = await backendApi.currentUser();
    const currentUserInfo = currentUser.user;
    console.log("Current user:", currentUser);
    const emailPlaceholder = document.getElementById("user-email-placeholder");
    if (emailPlaceholder) {
      emailPlaceholder.textContent = currentUserInfo.email;
    }
  } catch (err) {
    console.warn("Token invalid or expired:", err.message);
    clearToken();
    window.location.href = "/views/login.html";
  }
});

// Logout handler
async function logout() {
  try {
    await backendApi.logout?.();
  } catch (err) {
    console.warn("Logout API call failed:", err.message);
  } finally {
    clearToken();
    window.location.href = "/views/login.html";
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
  };
}

function renderApiUsageBanner(rawUsage) {
  const usage = normalizeApiUsage(rawUsage ?? apiUsageState);
  apiUsageState = usage;

  const usageContainer = document.getElementById("api-usage-container");
  const usageText = document.getElementById("api-usage-text");
  const submitButton = document.getElementById("create-speech-button");

  if (!usageContainer || !usageText) return usage;

  if (!usage) {
    usageContainer.classList.add("hidden");
    submitButton?.removeAttribute("disabled");
    submitButton?.classList.remove("cursor-not-allowed", "opacity-50");
    return usage;
  }

  usageContainer.classList.remove("hidden");
  usageText.textContent = `used ${usage.used} of ${usage.limit} AI API calls used. (${usage.remaining} remaining)`;

  if (usage.remaining <= 0) {
    submitButton?.setAttribute("disabled", true);
    submitButton?.classList.add("cursor-not-allowed", "opacity-50");
    showApiLimitWarning();
  } else {
    submitButton?.removeAttribute("disabled");
    submitButton?.classList.remove("cursor-not-allowed", "opacity-50");
    hideApiLimitWarning();
  }

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
    if (
      currentUser.success &&
      currentUser.user &&
      (currentUser.user.apiLimitExceeded || usage?.remaining <= 0)
    ) {
      showApiLimitWarning();
    } else {
      hideApiLimitWarning();
    }
  } catch (err) {
    console.warn("Failed to fetch user info:", err);
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
    console.error("Required DOM elements for text-to-speech are missing.");
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
          message || "Playback ready. Click play to listen.";
        if (audioUrl) {
          downloadLink.href = audioUrl;
          downloadLink.download = downloadName || "generated_speech.wav";
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
        audioStatus.textContent = message || "Generating audio, please wait...";
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
          message || "Failed to generate audio. Please try again.";
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
          message ||
          "Audio is currently disabled. Generate speech to enable playback.";
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

    if (
      apiUsageState?.remaining !== undefined &&
      apiUsageState.remaining <= 0
    ) {
      showApiLimitWarning();
      setAudioPlayerState("error", {
        message: "You have reached your API call limit.",
      });
      return;
    }

    if (!text) {
      setAudioPlayerState("error", {
        message: "Please enter some text to synthesize.",
      });
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Generating...";
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
        throw new Error("No audio data returned from synthesis service.");
      }

      const { objectUrl } = base64WavToObjectUrl(audioBase64);
      revokeCurrentUrl();
      currentObjectUrl = objectUrl;

      setAudioPlayerState("ready", {
        audioUrl: objectUrl,
        message: "Playback ready. Click play to listen.",
        downloadName: `tts-${Date.now()}.wav`,
      });
    } catch (error) {
      console.error("Failed to synthesize speech:", error);
      const message =
        error?.message || "Failed to generate audio. Please try again.";
      setAudioPlayerState("error", { message });
      if (error?.data?.apiUsage) {
        renderApiUsageBanner(error.data.apiUsage);
      }
      if (error?.status === 429) {
        showApiLimitWarning();
      }
    } finally {
      submitButton.disabled = apiUsageState?.remaining <= 0;
      submitButton.textContent = "Create Speech (Audio)";
    }
  });
  window.addEventListener("beforeunload", () => {
    revokeCurrentUrl();
  });
}
