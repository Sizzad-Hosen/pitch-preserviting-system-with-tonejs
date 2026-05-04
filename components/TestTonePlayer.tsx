"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

export default function TestTonePlayer() {
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const mountedRef = useRef(false);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const durationRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const speedRef = useRef<(typeof SPEED_OPTIONS)[number]>(1);
  const loadRequestRef = useRef(0);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_AUDIO_URL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [pitch, setPitch] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const getCurrentOffset = useCallback(() => {
    if (!isPlaying) return startOffsetRef.current;

    const elapsed = (Tone.now() - startTimeRef.current) * speedRef.current;
    const duration = durationRef.current || Number.POSITIVE_INFINITY;

    return Math.min(duration, startOffsetRef.current + elapsed);
  }, [isPlaying]);

  const stopProgressClock = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressClock = useCallback(() => {
    stopProgressClock();

    progressTimerRef.current = window.setInterval(() => {
      const elapsed = (Tone.now() - startTimeRef.current) * speedRef.current;
      const nextPosition = Math.min(
        durationRef.current,
        startOffsetRef.current + elapsed,
      );

      setPosition(nextPosition);

      if (durationRef.current > 0 && nextPosition >= durationRef.current) {
        playerRef.current?.stop();
        startOffsetRef.current = 0;
        startTimeRef.current = 0;
        setPosition(0);
        setIsPlaying(false);
        stopProgressClock();
      }
    }, 150);
  }, [stopProgressClock]);

  const resetPlaybackState = useCallback(() => {
    playerRef.current?.stop();
    startOffsetRef.current = 0;
    startTimeRef.current = 0;
    durationRef.current = 0;
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    stopProgressClock();
  }, [stopProgressClock]);

  useEffect(() => {
    mountedRef.current = true;

    const player = new Tone.GrainPlayer({
      url: DEFAULT_AUDIO_URL,
      playbackRate: speed,
      detune: pitch * 100,
      grainSize: 0.12,
      overlap: 0.06,
      loop: false,
      onload: () => {
        if (mountedRef.current) {
          durationRef.current = player.buffer.duration;
          setDuration(player.buffer.duration);
          setLoadState("ready");
        }
      },
      onerror: (error) => {
        if (mountedRef.current) {
          setLoadState("error");
          setErrorMessage(
            error.message ||
              "Audio failed to load. Try an HTTPS URL with CORS enabled.",
          );
        }
      },
    });

    player.toDestination();

    playerRef.current = player;

    return () => {
      mountedRef.current = false;
      stopProgressClock();
      player.stop();
      player.dispose();
      playerRef.current = null;
    };
    // Create the Tone player once, then control it through refs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      if (isPlaying) {
        startOffsetRef.current = getCurrentOffset();
        startTimeRef.current = Tone.now();
      }

      playerRef.current.playbackRate = speed;
    }

    speedRef.current = speed;
  }, [getCurrentOffset, isPlaying, speed]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.detune = pitch * 100;
    }
  }, [pitch]);

  const loadAudioUrl = async (nextUrl: string) => {
    if (!playerRef.current) return;

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

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    resetPlaybackState();
    setLoadState("loading");
    setErrorMessage("");
    setAudioUrl(playableUrl);
    setUrlInput(playableUrl);

    try {
      await playerRef.current.buffer.load(playableUrl);

      if (!mountedRef.current || loadRequestRef.current !== requestId) return;

      durationRef.current = playerRef.current.buffer.duration;
      setDuration(playerRef.current.buffer.duration);
      setLoadState("ready");
    } catch (error) {
      if (!mountedRef.current || loadRequestRef.current !== requestId) return;

      setLoadState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Audio failed to load. Try an HTTPS URL with CORS enabled.",
      );
    }
  };

  const handleUrlSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadAudioUrl(urlInput);
  };

  const play = async () => {
    if (loadState !== "ready" || !playerRef.current || isPlaying) return;

    try {
      // Browsers require AudioContext startup from a user gesture.
      await Tone.start();
      const nextOffset =
        startOffsetRef.current >= durationRef.current ? 0 : startOffsetRef.current;

      playerRef.current.start(undefined, nextOffset);
      startOffsetRef.current = nextOffset;
      startTimeRef.current = Tone.now();
      setPosition(nextOffset);
      setIsPlaying(true);
      startProgressClock();
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Playback could not start.",
      );
    }
  };

  const pause = () => {
    if (!playerRef.current) return;

    startOffsetRef.current = getCurrentOffset();
    playerRef.current.stop();
    setPosition(startOffsetRef.current);
    setIsPlaying(false);
    stopProgressClock();
  };

  const stop = () => {
    if (!playerRef.current) return;

    playerRef.current.stop();
    startOffsetRef.current = 0;
    startTimeRef.current = 0;
    setPosition(0);
    setIsPlaying(false);
    stopProgressClock();
  };

  const seek = (nextPosition: number) => {
    const boundedPosition = Math.min(
      durationRef.current,
      Math.max(0, nextPosition),
    );

    startOffsetRef.current = boundedPosition;
    setPosition(boundedPosition);

    if (isPlaying && playerRef.current) {
      playerRef.current.stop();
      playerRef.current.start(undefined, boundedPosition);
      startTimeRef.current = Tone.now();
      startProgressClock();
    }
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
        <h2 className="text-2xl font-semibold">Tone.js Test Player</h2>
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
