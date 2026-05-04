import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mockPlayer = {
  buffer: {
    duration: 125,
    load: vi.fn(() => Promise.resolve(mockPlayer)),
  },
  connect: vi.fn(),
  dispose: vi.fn(),
  restart: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  toDestination: vi.fn(() => mockPlayer),
  playbackRate: 1,
  detune: 0,
};

vi.mock("tone", () => ({
  GrainPlayer: vi.fn(function GrainPlayer(options: { onload?: () => void }) {
    queueMicrotask(() => options.onload?.());
    return mockPlayer;
  }),
  now: vi.fn(() => 0),
  start: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  vi.clearAllMocks();
  mockPlayer.buffer.duration = 125;
  mockPlayer.playbackRate = 1;
  mockPlayer.detune = 0;
  mockPlayer.buffer.load.mockResolvedValue(mockPlayer);
});

describe("Home Tone.js test player", () => {
  it("renders the hardcoded URL player and enables controls after load", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /tone\.js test player/i }),
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

  it("loads a pasted audio URL into the existing player", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");

    const nextUrl =
      "https://tonejs.github.io/audio/berklee/gurgling_theremin_1.mp3";

    await user.clear(screen.getByLabelText(/audio url/i));
    await user.type(screen.getByLabelText(/audio url/i), nextUrl);
    await user.click(screen.getByRole("button", { name: /load url/i }));

    expect(mockPlayer.stop).toHaveBeenCalled();
    expect(mockPlayer.buffer.load).toHaveBeenCalledWith(nextUrl);
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

    expect(mockPlayer.buffer.load).toHaveBeenCalledWith(rawUrl);
    expect(await screen.findByDisplayValue(rawUrl)).toBeInTheDocument();
  });

  it("starts, pauses, and stops playback", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: /play/i }));

    expect(mockPlayer.start).toHaveBeenCalledWith(undefined, 0);
    expect(screen.getByText("Playing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(mockPlayer.stop).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("restarts from a committed seek position while playing", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: /play/i }));

    const playback = screen.getByLabelText(/playback/i);

    fireEvent.change(playback, { target: { value: "80" } });
    expect(mockPlayer.restart).not.toHaveBeenCalled();

    fireEvent.mouseUp(playback, { currentTarget: { value: "80" } });
    expect(mockPlayer.restart).toHaveBeenCalledWith(undefined, 80);
  });

  it("updates speed and pitch controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(screen.getAllByText("1.5x")).toHaveLength(2);
    expect(mockPlayer.playbackRate).toBe(1.5);
    expect(mockPlayer.detune).toBe(0);

    fireEvent.change(screen.getByLabelText(/pitch/i), {
      target: { value: "4" },
    });

    expect(screen.getByText("+4 semitones")).toBeInTheDocument();
    expect(mockPlayer.detune).toBe(400);
  });
});
