"""FastAPI microservice for coqui/XTTS-v2 speech synthesis."""
from __future__ import annotations

import base64
import logging
import os
import tempfile
from pathlib import Path
from typing import List, Optional

import requests
from fastapi import Body, FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AnyHttpUrl, BaseModel, Field, model_validator

from model_loader import loader
from voice_registry import VoiceRegistry

LOGGER = logging.getLogger("xtts.api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="XTTS Speech Service", version="1.0.0")

raw_origins = os.getenv("XTTS_ALLOW_ORIGINS", "").split(",")
origins = [origin.strip() for origin in raw_origins if origin.strip()]
if not origins:
    origins = ["http://localhost:3000", "http://127.0.0.1:8080", "https://comp4537-group5-9lwth.ondigitalocean.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

voices_dir = Path(os.getenv("XTTS_VOICE_DIR", Path(__file__).resolve().parent / "voices"))
voices_dir.mkdir(parents=True, exist_ok=True)

default_voice_path = os.getenv("XTTS_DEFAULT_VOICE")
if not default_voice_path:
    samples_dir = Path(__file__).resolve().parent / "samples"
    candidate = next(samples_dir.glob("*.wav"), None)
    if candidate:
        default_voice_path = str(candidate)

registry = VoiceRegistry(voices_dir, Path(default_voice_path) if default_voice_path else None)

store_dir = Path(os.getenv("XTTS_STORE_DIR", Path(__file__).resolve().parent / "generated"))
store_dir.mkdir(parents=True, exist_ok=True)


class VoiceRegistrationRequest(BaseModel):
    display_name: Optional[str] = Field(None, description="Human-friendly name for the speaker")
    language: Optional[str] = Field(None, description="Language hint for the speaker clip")
    speaker_wav_base64: Optional[str] = Field(None, description="Base64 encoded WAV file")
    speaker_wav_url: Optional[AnyHttpUrl] = Field(None, description="URL pointing to a WAV file")

    @model_validator(mode="after")
    def validate_source(self):
        if self.speaker_wav_url:
            raise ValueError("speaker_wav_url is disabled; use speaker_wav_base64 instead")
        if not self.speaker_wav_base64:
            raise ValueError("Provide speaker_wav_base64")
        return self


class VoiceRegistrationResponse(BaseModel):
    voice_id: str
    display_name: str
    language: str


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=800)
    language: str = Field("en", description="Language token supported by XTTS")
    speaker_id: Optional[str] = Field("default", description="ID of a previously registered voice")
    speaker_wav_base64: Optional[str] = Field(None, description="Override the reference audio with base64 WAV")
    speaker_wav_url: Optional[AnyHttpUrl] = Field(None, description="Override the reference audio with an external WAV")
    store_generated_audio: bool = Field(False, description="Persist the generated clip to disk")

    @model_validator(mode="after")
    def validate_reference(self):
        if self.speaker_wav_url:
            raise ValueError("speaker_wav_url is disabled; use speaker_wav_base64 or speaker_id")
        if not (self.speaker_wav_base64 or self.speaker_id):
            raise ValueError("Provide speaker_wav_base64 or speaker_id")
        return self


class SynthesizeResponse(BaseModel):
    format: str = Field("wav", description="Container format for the audio payload")
    sample_rate: int = Field(24000, description="Sample rate in Hz")
    audio_base64: str
    duration_seconds: Optional[float] = None


class ServiceConfig(BaseModel):
    model_repo: str
    model_dir: str
    languages: List[dict]
    voices: List[dict]


@app.get("/health")
def healthcheck() -> dict:
    """Lightweight health probe."""
    return {"status": "ok"}


@app.get("/api/v1/tts/config", response_model=ServiceConfig)
def get_config() -> ServiceConfig:
    languages = loader.get_supported_languages()
    return ServiceConfig(
        model_repo=loader.repo_id,
        model_dir=str(loader.model_dir),
        languages=[{"id": key, "label": value} for key, value in languages.items()],
        voices=registry.list_voices(),
    )


@app.get("/api/v1/tts/voices")
def list_voices() -> dict:
    return {"voices": registry.list_voices()}


@app.post("/api/v1/tts/voices", response_model=VoiceRegistrationResponse, status_code=201)
def register_voice(payload: VoiceRegistrationRequest = Body(...)) -> VoiceRegistrationResponse:
    temp_file = None
    try:
        if payload.speaker_wav_base64:
            temp_file = _base64_to_temp(payload.speaker_wav_base64)
        else:
            raise HTTPException(status_code=400, detail="No voice source provided")

        metadata = registry.register_voice(
            temp_file,
            display_name=payload.display_name,
            language=payload.language,
        )
        return VoiceRegistrationResponse(**metadata)
    finally:
        if temp_file and temp_file.exists():
            temp_file.unlink(missing_ok=True)


@app.post("/api/v1/tts/synthesize", response_model=SynthesizeResponse)
async def synthesize(payload: SynthesizeRequest = Body(...)) -> SynthesizeResponse:
    try:
        tts = loader.get_tts()
    except Exception as exc:  # pragma: no cover - protects against download failures in CI
        LOGGER.exception("Failed to load XTTS model")
        raise HTTPException(status_code=503, detail=f"XTTS model unavailable: {exc}") from exc

    speaker_path: Optional[Path] = None
    temp_files: List[Path] = []
    try:
        if payload.speaker_wav_base64:
            speaker_path = _base64_to_temp(payload.speaker_wav_base64)
            temp_files.append(speaker_path)
        elif payload.speaker_id:
            speaker_path = registry.get_voice_path(payload.speaker_id)
            if speaker_path is None:
                raise HTTPException(status_code=404, detail=f"Unknown speaker_id '{payload.speaker_id}'")
        else:
            raise HTTPException(status_code=400, detail="No speaker reference provided")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as outfile:
            output_path = Path(outfile.name)

        def _run_tts() -> Path:
            LOGGER.info("Synthesising text with XTTS (language=%s, speaker=%s)", payload.language, speaker_path)
            tts.tts_to_file(
                text=payload.text,
                file_path=str(output_path),
                speaker_wav=str(speaker_path),
                language=payload.language,
            )
            return output_path

        result_path: Path = await run_in_threadpool(_run_tts)
        audio_bytes = result_path.read_bytes()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        if payload.store_generated_audio:
            stored_path = store_dir / result_path.name
            stored_path.write_bytes(audio_bytes)
            LOGGER.info("Stored generated clip at %s", stored_path)

        try:
            import soundfile as sf

            with sf.SoundFile(result_path) as snd:
                duration = len(snd) / float(snd.samplerate)
                sample_rate = snd.samplerate
        except Exception:
            duration = None
            sample_rate = 24000

        return SynthesizeResponse(
            audio_base64=audio_base64,
            duration_seconds=duration,
            sample_rate=sample_rate,
        )
    finally:
        for temp in temp_files:
            temp.unlink(missing_ok=True)
        if 'result_path' in locals():
            Path(result_path).unlink(missing_ok=True)


def _base64_to_temp(b64_data: str) -> Path:
    try:
        decoded = base64.b64decode(b64_data)
    except Exception as exc:  # pragma: no cover - invalid base64 guard
        raise HTTPException(status_code=400, detail="Invalid base64 payload") from exc

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
        handle.write(decoded)
        return Path(handle.name)


def _download_to_temp(url: AnyHttpUrl) -> Path:
    raise HTTPException(status_code=400, detail="speaker_wav_url is disabled; provide base64 audio instead")


@app.on_event("startup")
def preload_languages() -> None:
    """Warm the language map early so config requests are fast."""
    try:
        loader.get_supported_languages()
    except Exception as exc:  # pragma: no cover - download guard
        LOGGER.warning("Could not preload languages: %s", exc)
