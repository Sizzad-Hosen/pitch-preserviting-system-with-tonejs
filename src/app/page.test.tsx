import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

type AudioEventName =
  | "canplay"
  | "ended"
  | "error"
  | "loadedmetadata"
  | "pause"
  | "playing"
  | "seeked"
  | "seeking"
  | "timeupdate"
  | "waiting";

function createMockAudio() {
  const listeners = new Map<AudioEventName, Set<() => void>>();

  const audio = {
    crossOrigin: "",
    currentTime: 0,
    duration: 125,
    paused: true,
    playbackRate: 1,
    preload: "",
    preservesPitch: true,
    src: "",
    volume: 1,
    addEventListener: vi.fn((event: AudioEventName, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(listener);
    }),
    dispatch: (event: AudioEventName) => {
      listeners.get(event)?.forEach((listener) => listener());
    },
    load: vi.fn(() => {
      queueMicrotask(() => audio.dispatch("loadedmetadata"));
    }),
    pause: vi.fn(() => {
      audio.paused = true;
      audio.dispatch("pause");
    }),
    play: vi.fn(() => {
      audio.paused = false;
      audio.dispatch("playing");
      return Promise.resolve();
    }),
    removeAttribute: vi.fn((attribute: string) => {
      if (attribute === "src") audio.src = "";
    }),
    removeEventListener: vi.fn(
      (event: AudioEventName, listener: () => void) => {
        listeners.get(event)?.delete(listener);
      },
    ),
  };

  return audio;
}

const mockMediaSource = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  numberOfOutputs: 1,
};

const mockPitchShift = {
  dispose: vi.fn(),
  pitch: 0,
  toDestination: vi.fn(() => mockPitchShift),
};

vi.mock("tone", () => ({
  connect: vi.fn(),
  getContext: vi.fn(() => ({
    createMediaElementSource: vi.fn(() => mockMediaSource),
  })),
  PitchShift: vi.fn(function PitchShift() {
    return mockPitchShift;
  }),
  start: vi.fn(() => Promise.resolve()),
}));

let mockAudio: ReturnType<typeof createMockAudio>;
let createElementSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockAudio = createMockAudio();
  const originalCreateElement = document.createElement.bind(document);

  createElementSpy = vi
    .spyOn(document, "createElement")
    .mockImplementation((tagName: string) => {
      if (tagName === "audio") {
        return mockAudio as unknown as HTMLAudioElement;
      }

      return originalCreateElement(tagName);
    });
});

afterEach(() => {
  createElementSpy.mockRestore();
  vi.clearAllMocks();
  mockPitchShift.pitch = 0;
});

describe("Home Tone.js test player", () => {
  it("renders the default URL player and enables controls after metadata loads", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /test player/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "https://cdn.jsdelivr.net/gh/mdn/webaudio-examples/audio-basics/outfoxing.mp3",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/loading audio/i)).toBeInTheDocument();

    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeEnabled();
    expect(screen.getByLabelText(/playback/i)).toBeEnabled();
    expect(screen.getByText("0:00 / 2:05")).toBeInTheDocument();
  });

  it("loads a pasted audio URL into the media element", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");

    const nextUrl =
      "https://tonejs.github.io/audio/berklee/gurgling_theremin_1.mp3";

    await user.clear(screen.getByLabelText(/audio url/i));
    await user.type(screen.getByLabelText(/audio url/i), nextUrl);
    await user.click(screen.getByRole("button", { name: /load url/i }));

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.src).toBe(nextUrl);
    expect(mockAudio.load).toHaveBeenCalled();
    expect(await screen.findByText(nextUrl)).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("converts GitHub blob URLs to raw audio URLs before loading", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");

    const blobUrl =
      "https://github.com/Sizzad-Hosen/pitch-preserviting-system-with-tonejs/blob/main/public/audio/Alan%20Walker%20%20Faded.mp3";
    const rawUrl =
      "https://raw.githubusercontent.com/Sizzad-Hosen/pitch-preserviting-system-with-tonejs/main/public/audio/Alan%20Walker%20%20Faded.mp3";

    await user.clear(screen.getByLabelText(/audio url/i));
    await user.type(screen.getByLabelText(/audio url/i), blobUrl);
    await user.click(screen.getByRole("button", { name: /load url/i }));

    expect(mockAudio.src).toBe(rawUrl);
    expect(await screen.findByDisplayValue(rawUrl)).toBeInTheDocument();
  });

  it("starts, pauses, and stops playback", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: /play/i }));

    expect(mockAudio.play).toHaveBeenCalled();
    expect(screen.getByText("Playing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(mockAudio.pause).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(mockAudio.currentTime).toBe(0);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("seeks directly with the media element instead of restarting a buffer source", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: /play/i }));

    fireEvent.change(screen.getByLabelText(/playback/i), {
      target: { value: "80" },
    });

    expect(mockAudio.currentTime).toBe(80);
    expect(screen.getByText("1:20 / 2:05")).toBeInTheDocument();
  });

  it("updates speed and pitch controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(screen.getAllByText("1.5x")).toHaveLength(2);
    expect(mockAudio.playbackRate).toBe(1.5);

    fireEvent.change(screen.getByLabelText(/pitch/i), {
      target: { value: "4" },
    });

    expect(screen.getByText("+4 semitones")).toBeInTheDocument();
    expect(mockPitchShift.pitch).toBe(4);
  });

  it("supports relative same-origin server audio paths and volume control", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");

    await user.clear(screen.getByLabelText(/audio url/i));
    await user.type(screen.getByLabelText(/audio url/i), "/audio/song.mp3");
    await user.click(screen.getByRole("button", { name: /load url/i }));

    expect(mockAudio.src).toBe("/audio/song.mp3");
    expect(await screen.findByDisplayValue("/audio/song.mp3")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/volume/i), {
      target: { value: "0.4" },
    });

    expect(mockAudio.volume).toBe(0.4);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
