"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import {
  Gauge,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  Volume2,
} from "lucide-react";

const speedMarks = [0.5, 0.75, 1, 1.25, 1.5, 2];

type LoadState = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);
  const startClockRef = useRef(0);
  const startOffsetRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [audioName, setAudioName] = useState("Upload an audio lesson");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(-4);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const statusText = useMemo(() => {
    if (loadState === "loading") return "Preparing signal chain";
    if (loadState === "error") return "Audio could not be loaded";
    if (loadState === "ready") return isPlaying ? "Playing" : "Ready";
    return "Waiting for audio";
  }, [isPlaying, loadState]);

  function stopProgressClock() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  useEffect(() => {
    const pitchNode = new Tone.PitchShift({ pitch: 0 }).toDestination();
    pitchShiftRef.current = pitchNode;

    return () => {
      stopProgressClock();
      playerRef.current?.dispose();
      pitchShiftRef.current?.dispose();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (pitchShiftRef.current) pitchShiftRef.current.pitch = pitch;
  }, [pitch]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.playbackRate = tempo;
  }, [tempo]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.volume.value = volume;
  }, [volume]);

  const startProgressClock = () => {
    stopProgressClock();
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = (Tone.now() - startClockRef.current) * tempo;
      const nextPosition = Math.min(duration, startOffsetRef.current + elapsed);
      setPosition(nextPosition);

      if (duration > 0 && nextPosition >= duration) {
        setIsPlaying(false);
        setPosition(0);
        startOffsetRef.current = 0;
        stopProgressClock();
      }
    }, 120);
  };

  const handleAudioUpload = async (file: File | undefined) => {
    if (!file) return;

    setLoadState("loading");
    setIsPlaying(false);
    setPosition(0);
    startOffsetRef.current = 0;
    stopProgressClock();
    playerRef.current?.dispose();

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
    setAudioName(file.name);

    try {
      const player = new Tone.GrainPlayer({
        url: nextUrl,
        grainSize: 0.08,
        overlap: 0.04,
        loop: false,
        playbackRate: tempo,
      });

      await Tone.loaded();
      player.volume.value = volume;
      player.connect(pitchShiftRef.current ?? Tone.Destination);
      playerRef.current = player;
      setDuration(player.buffer.duration);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  };

  const playFrom = async (offset: number) => {
    if (!playerRef.current || loadState !== "ready") return;

    await Tone.start();
    playerRef.current.stop();
    playerRef.current.start(undefined, offset);
    startClockRef.current = Tone.now();
    startOffsetRef.current = offset;
    setPosition(offset);
    setIsPlaying(true);
    startProgressClock();
  };

  const togglePlayback = async () => {
    if (!playerRef.current || loadState !== "ready") return;

    if (isPlaying) {
      const elapsed = (Tone.now() - startClockRef.current) * tempo;
      const pausedAt = Math.min(duration, startOffsetRef.current + elapsed);
      playerRef.current.stop();
      startOffsetRef.current = pausedAt;
      setPosition(pausedAt);
      setIsPlaying(false);
      stopProgressClock();
      return;
    }

    await playFrom(position >= duration ? 0 : position);
  };

  const resetPlayback = () => {
    playerRef.current?.stop();
    startOffsetRef.current = 0;
    setPosition(0);
    setIsPlaying(false);
    stopProgressClock();
  };

  const seek = async (nextValue: number) => {
    const nextPosition = Number(nextValue);
    setPosition(nextPosition);
    startOffsetRef.current = nextPosition;

    if (isPlaying) {
      await playFrom(nextPosition);
    }
  };

  const formattedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${rest}`;
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#151922]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-[#dde5ef] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
              Pitch-preserving playback
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#111827] sm:text-4xl">
              Learning audio player
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[#dbe3ef] bg-[#f8fafc] px-3 py-2 text-sm font-medium text-[#334155]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            {statusText}
          </div>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-[#dde5ef] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
                    <Music2 size={30} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold text-[#111827]">
                      {audioName}
                    </p>
                    <p className="mt-1 text-sm text-[#64748b]">
                      Upload audio, then control speed without pitch distortion.
                    </p>
                  </div>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
                  <Upload size={18} />
                  Upload audio
                  <input
                    className="sr-only"
                    type="file"
                    accept="audio/*"
                    onChange={(event) => handleAudioUpload(event.target.files?.[0])}
                  />
                </label>
              </div>

              <div className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#64748b]">Transport</p>
                    <p className="mt-1 text-2xl font-semibold text-[#111827]">
                      {formattedTime(position)} / {formattedTime(duration)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-md bg-[#ef4444] text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
                      onClick={togglePlayback}
                      disabled={loadState !== "ready"}
                      aria-label={isPlaying ? "Pause" : "Play"}
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                    </button>
                    <button
                      type="button"
                      className="flex h-12 w-12 items-center justify-center rounded-md border border-[#cbd5e1] bg-white text-[#334155] transition hover:bg-[#eef2f7]"
                      onClick={resetPlayback}
                      aria-label="Reset"
                      title="Reset"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>
                </div>
                <input
                  className="mt-5 w-full accent-[#ef4444]"
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={position}
                  onChange={(event) => seek(Number(event.target.value))}
                  disabled={loadState !== "ready"}
                  aria-label="Playback position"
                />
              </div>

              {audioUrl ? (
                <audio className="mt-5 w-full" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#64748b]">Speed</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">
                  {tempo.toFixed(2)}x
                </p>
              </div>
              <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#64748b]">Pitch</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">
                  {pitch > 0 ? "+" : ""}
                  {pitch} st
                </p>
              </div>
              <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#64748b]">Output</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">
                  {volume} dB
                </p>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                <Gauge size={18} />
                Tempo
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl font-semibold text-[#111827]">
                  {tempo.toFixed(2)}x
                </span>
                <span className="text-sm text-[#64748b]">pitch preserved</span>
              </div>
              <input
                className="mt-5 w-full accent-[#2563eb]"
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                value={tempo}
                onChange={(event) => setTempo(Number(event.target.value))}
                aria-label="Tempo"
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {speedMarks.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className="h-9 rounded-md border border-[#cbd5e1] text-sm font-semibold text-[#334155] transition hover:bg-[#eef2f7] aria-pressed:border-[#2563eb] aria-pressed:bg-[#2563eb] aria-pressed:text-white"
                    onClick={() => setTempo(speed)}
                    aria-pressed={tempo === speed}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                <SlidersHorizontal size={18} />
                Pitch
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl font-semibold text-[#111827]">
                  {pitch > 0 ? "+" : ""}
                  {pitch}
                </span>
                <span className="text-sm text-[#64748b]">semitones</span>
              </div>
              <input
                className="mt-5 w-full accent-[#7c3aed]"
                type="range"
                min="-12"
                max="12"
                step="1"
                value={pitch}
                onChange={(event) => setPitch(Number(event.target.value))}
                aria-label="Pitch shift"
              />
            </div>

            <div className="rounded-lg border border-[#dde5ef] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                <Volume2 size={18} />
                Output
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-4xl font-semibold text-[#111827]">
                  {volume} dB
                </span>
                <span className="text-sm text-[#64748b]">master gain</span>
              </div>
              <input
                className="mt-5 w-full accent-[#ef4444]"
                type="range"
                min="-30"
                max="6"
                step="1"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Volume"
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
