"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

const DEFAULT_AUDIO_URL =
  "https://cdn.jsdelivr.net/gh/mdn/webaudio-examples/audio-basics/outfoxing.mp3";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;
const MIN_PITCH = -4;
const MAX_PITCH = 4;

type LoadState = "loading" | "ready" | "error";

function normalizeAudioUrl(input: string) {
  const trimmedUrl = input.trim();
  const parsedUrl = new URL(trimmedUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use a valid http or https audio URL.");
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

  return trimmedUrl;
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

export default function TestTonePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_AUDIO_URL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [pitch, setPitch] = useState(0);
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
    audio.src = DEFAULT_AUDIO_URL;
    audio.playbackRate = speed;
    setPreservesPitch(audio, true);

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

    const handleEnded = () => {
      setIsPlaying(false);
      setPosition(0);
      audio.currentTime = 0;
    };

    const handleError = () => {
      setIsPlaying(false);
      setLoadState("error");
      setErrorMessage(
        "Audio failed to load. Use a direct MP3/WAV URL with CORS enabled.",
      );
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.load();

    audioRef.current = audio;
    mediaSourceRef.current = mediaSource;
    pitchShiftRef.current = pitchShift;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
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
            type="url"
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
          disabled={!isReady || !isPlaying}
          className="rounded-md bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isReady}
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
          disabled={!isReady}
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
    </section>
  );
}
