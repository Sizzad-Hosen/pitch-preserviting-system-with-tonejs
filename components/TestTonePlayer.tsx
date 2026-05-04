"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

const DEFAULT_AUDIO_URL =
  process.env.NEXT_PUBLIC_DEFAULT_AUDIO_URL ||
  "https://cdn.jsdelivr.net/gh/mdn/webaudio-examples/audio-basics/outfoxing.mp3";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const MIN_PITCH = -4;
const MAX_PITCH = 4;
const DEFAULT_VOLUME = 1;

type LoadState = "idle" | "loading" | "ready" | "buffering" | "error";

type TestTonePlayerProps = {
  defaultAudioUrl?: string;
};

function normalizeAudioUrl(input: string) {
  const trimmedUrl = input.trim();
  const parsedUrl = new URL(trimmedUrl, window.location.origin);

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.origin === "null"
  ) {
    throw new Error("Use a valid audio URL.");
  }

  const [, owner, repo, marker, branch, ...filePath] =
    parsedUrl.pathname.split("/");

  if (
    parsedUrl.hostname === "github.com" &&
    owner &&
    repo &&
    marker === "blob" &&
    branch &&
    filePath.length > 0
  ) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath.join("/")}`;
  }

  if (parsedUrl.origin === window.location.origin && trimmedUrl.startsWith("/")) {
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  }

  return parsedUrl.href;
}

function setPreservesPitch(audio: HTMLAudioElement, enabled: boolean) {
  const audioWithVendorFlags = audio as HTMLAudioElement & {
    mozPreservesPitch?: boolean;
    preservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };

  audioWithVendorFlags.preservesPitch = enabled;
  audioWithVendorFlags.mozPreservesPitch = enabled;
  audioWithVendorFlags.webkitPreservesPitch = enabled;
}

function getMediaErrorMessage(error: MediaError | null) {
  if (!error) {
    return "Audio failed to load. Use a direct MP3/WAV URL with CORS enabled.";
  }

  if (error.code === MediaError.MEDIA_ERR_ABORTED) {
    return "Audio loading was aborted.";
  }

  if (error.code === MediaError.MEDIA_ERR_NETWORK) {
    return "Network error while loading audio. Check the server URL and CORS.";
  }

  if (error.code === MediaError.MEDIA_ERR_DECODE) {
    return "The browser could not decode this audio file.";
  }

  if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This URL is not a supported direct audio file.";
  }

  return "Audio failed to load. Use a direct MP3/WAV URL with CORS enabled.";
}

export default function TestTonePlayer({
  defaultAudioUrl = DEFAULT_AUDIO_URL,
}: TestTonePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);
  const currentUrlRef = useRef(defaultAudioUrl);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState(defaultAudioUrl);
  const [urlInput, setUrlInput] = useState(defaultAudioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = document.createElement("audio");
    const pitchShift = new Tone.PitchShift({
      pitch: 0,
      windowSize: 0.08,
    }).toDestination();

    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.playbackRate = speed;
    audio.volume = volume;
    setPreservesPitch(audio, true);

    try {
      const playableDefaultUrl = normalizeAudioUrl(currentUrlRef.current);
      audio.src = playableDefaultUrl;
      currentUrlRef.current = playableDefaultUrl;
      setAudioUrl(playableDefaultUrl);
      setUrlInput(playableDefaultUrl);
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Use a valid audio URL.",
      );
    }

    const mediaSource = Tone.getContext().createMediaElementSource(audio);
    Tone.connect(mediaSource, pitchShift);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setPosition(audio.currentTime || 0);
      setLoadState("ready");
      setErrorMessage("");
    };

    const handleTimeUpdate = () => {
      setPosition(audio.currentTime || 0);
    };

    const handleCanPlay = () => {
      setDuration(audio.duration || 0);
      setLoadState("ready");
      setErrorMessage("");
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPosition(0);
      audio.currentTime = 0;
    };

    const handleError = () => {
      setIsPlaying(false);
      setLoadState("error");
      setErrorMessage(getMediaErrorMessage(audio.error));
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setLoadState("ready");
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleSeeked = () => {
      setPosition(audio.currentTime || 0);
      if (!audio.paused) setLoadState("ready");
    };

    const handleSeeking = () => {
      setPosition(audio.currentTime || 0);
      if (!audio.paused) setLoadState("buffering");
    };

    const handleWaiting = () => {
      if (!audio.paused) setLoadState("buffering");
    };

    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("waiting", handleWaiting);
    audio.load();

    audioRef.current = audio;
    mediaSourceRef.current = mediaSource;
    pitchShiftRef.current = pitchShift;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("waiting", handleWaiting);
      mediaSource.disconnect();
      pitchShift.dispose();
      audioRef.current = null;
      mediaSourceRef.current = null;
      pitchShiftRef.current = null;
    };
    // Create the media element and Tone graph once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.playbackRate = speed;
    setPreservesPitch(audioRef.current, true);
  }, [speed]);

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = pitch;
    }
  }, [pitch]);

  const loadAudioUrl = async (nextUrl: string) => {
    if (!audioRef.current) return;

    let playableUrl: string;

    try {
      playableUrl = normalizeAudioUrl(nextUrl);
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Use a valid audio URL.",
      );
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = playableUrl;
    audioRef.current.load();
    currentUrlRef.current = playableUrl;

    setAudioUrl(playableUrl);
    setUrlInput(playableUrl);
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    setLoadState("loading");
    setErrorMessage("");
  };

  const handleUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadAudioUrl(urlInput);
  };

  const play = async () => {
    if (loadState !== "ready" || !audioRef.current || isPlaying) return;

    try {
      await Tone.start();

      if (audioRef.current.currentTime >= audioRef.current.duration) {
        audioRef.current.currentTime = 0;
      }

      await audioRef.current.play();
      setIsPlaying(true);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Playback could not start.",
      );
    }
  };

  const pause = () => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    setPosition(audioRef.current.currentTime || 0);
    setIsPlaying(false);
  };

  const stop = () => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPosition(0);
    setIsPlaying(false);
  };

  const seek = (nextPosition: number) => {
    if (!audioRef.current) return;

    const boundedPosition = Math.min(duration, Math.max(0, nextPosition));
    audioRef.current.currentTime = boundedPosition;
    setPosition(boundedPosition);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${rest}`;
  };

  const isReady = loadState === "ready";
  const canUseTransport = loadState === "ready" || loadState === "buffering";

  return (
    <section className="mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-slate-950 shadow-sm">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">Test Player</h2>
        <p className="mt-2 break-all text-sm text-slate-600">{audioUrl}</p>
      </div>

      <form onSubmit={handleUrlSubmit} className="mb-5 flex flex-col gap-3">
        <label htmlFor="audio-url" className="text-sm font-medium">
          Audio URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="audio-url"
            type="text"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://example.com/song.mp3"
            className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="min-h-11 rounded-md bg-blue-600 px-4 font-medium text-white hover:bg-blue-700"
          >
            Load URL
          </button>
        </div>
      </form>

      <div className="mb-5 rounded-md bg-slate-50 p-3 text-sm">
        <span className="font-medium">Status: </span>
        {loadState === "loading" && "Loading audio..."}
        {loadState === "buffering" && "Buffering..."}
        {loadState === "ready" && (isPlaying ? "Playing" : "Ready")}
        {loadState === "error" && `Error - ${errorMessage}`}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={play}
          disabled={!isReady || isPlaying}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Play
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!canUseTransport || !isPlaying}
          className="rounded-md bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!canUseTransport}
          className="rounded-md bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Stop
        </button>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="test-tone-position" className="font-medium">
            Playback
          </label>
          <span className="text-sm text-slate-600">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </div>
        <input
          id="test-tone-position"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={position}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={!canUseTransport}
          className="w-full accent-blue-600 disabled:opacity-50"
        />
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="font-medium">Speed</label>
          <span className="text-sm text-slate-600">{speed}x</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSpeed(option)}
              aria-pressed={speed === option}
              className="rounded-md border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white"
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="test-tone-pitch" className="font-medium">
            Pitch
          </label>
          <span className="text-sm text-slate-600">
            {pitch > 0 ? "+" : ""}
            {pitch} semitones
          </span>
        </div>
        <input
          id="test-tone-pitch"
          type="range"
          min={MIN_PITCH}
          max={MAX_PITCH}
          step={1}
          value={pitch}
          onChange={(event) => setPitch(Number(event.target.value))}
          className="w-full accent-blue-600"
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="test-tone-volume" className="font-medium">
            Volume
          </label>
          <span className="text-sm text-slate-600">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <input
          id="test-tone-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="w-full accent-blue-600"
        />
      </div>
    </section>
  );
}
