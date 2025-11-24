// Utility helpers for working with audio data returned by the AI server

import { AUDIO_MIME_TYPES, UI_STRINGS } from "./constants.js";

/**
 * Converts a base64-encoded WAV string into a Blob URL playable by HTMLAudioElement.
 * Returns an object containing both the Blob and the generated object URL so callers
 * can revoke it once playback is complete.
 */
export function base64WavToObjectUrl(base64Audio) {
  if (!base64Audio) {
    throw new Error(UI_STRINGS.AUDIO.NO_AUDIO);
  }

  const byteCharacters = atob(base64Audio);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: AUDIO_MIME_TYPES.WAV });
  const objectUrl = URL.createObjectURL(blob);

  return { blob, objectUrl };
}
