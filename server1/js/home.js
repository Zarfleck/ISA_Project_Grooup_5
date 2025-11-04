// Logic for home.html
// - Basic guard: if no token, redirect to login
// - Fetch profile to verify token and check API limits

import { requireAuth } from "./auth.js";
import { api, aiApi, showApiLimitWarning, hideApiLimitWarning } from './apiClient.js';
import { base64WavToObjectUrl } from "./audio.js";

requireAuth("login.html");



// Check user status and API limits on page load
document.addEventListener('DOMContentLoaded', async () => {
      await checkCurrentUser();
      initializeTextToSpeechForm();
    });

async function checkCurrentUser() {
  try {
    const currentUser = await api.currentUser();
    if (currentUser.success && currentUser.user && currentUser.user.apiLimitExceeded) {
      showApiLimitWarning();
    } else {
      hideApiLimitWarning();
    }
  } catch (err) {
    console.warn('Failed to fetch user info:', err);
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

  if (!form || !languageSelect || !textInput || !submitButton || !audioCard || !audioControls || !audioStatus || !downloadLink) {
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

  function setAudioPlayerState(state, { audioUrl, message, downloadName } = {}) {
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
        audioStatus.textContent = message || "Playback ready. Click play to listen.";
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
        audioCard.classList.add(...DISABLED_CLASSES, "border-red-500", "dark:border-red-400", "bg-red-50", "dark:bg-red-900/40");
        audioStatus.classList.add("text-red-600", "dark:text-red-300");
        audioStatus.textContent = message || "Failed to generate audio. Please try again.";
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
          message || "Audio is currently disabled. Generate speech to enable playback.";
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
    const language = (languageSelect.value || "en").toLowerCase();

    if (!text) {
      setAudioPlayerState("error", { message: "Please enter some text to synthesize." });
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

      const { audio_base64: audioBase64, duration_seconds: durationSeconds, sample_rate: sampleRate } = response;

      if (!audioBase64) {
        throw new Error("No audio data returned from synthesis service.");
      }

      const { objectUrl } = base64WavToObjectUrl(audioBase64);
      revokeCurrentUrl();
      currentObjectUrl = objectUrl;

      const infoParts = ["Playback ready. Click play to listen."];
      if (durationSeconds) {
        infoParts.push(`~${durationSeconds.toFixed(1)}s`);
      }
      if (sampleRate) {
        infoParts.push(`${sampleRate} Hz`);
      }

      setAudioPlayerState("ready", {
        audioUrl: objectUrl,
        message: infoParts.join(" • "),
        downloadName: `tts-${Date.now()}.wav`,
      });
    } catch (error) {
      console.error("Failed to synthesize speech:", error);
      const message = error?.message || "Failed to generate audio. Please try again.";
      setAudioPlayerState("error", { message });
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create Speech (Audio)";
    }
  });
    window.addEventListener("beforeunload", () => {
    revokeCurrentUrl();
  });
}