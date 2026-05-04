import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mockPlayer = {
  buffer: { duration: 125 },
  connect: vi.fn(),
  dispose: vi.fn(),
  load: vi.fn(() => Promise.resolve(mockPlayer)),
  start: vi.fn(),
  stop: vi.fn(),
  playbackRate: 1,
};

const mockPitchShift = {
  dispose: vi.fn(),
  toDestination: vi.fn(() => mockPitchShift),
  pitch: 0,
};

vi.mock("tone", () => ({
  Player: vi.fn(function Player(options: { onload?: () => void }) {
    queueMicrotask(() => options.onload?.());
    return mockPlayer;
  }),
  PitchShift: vi.fn(function PitchShift() {
    return mockPitchShift;
  }),
  now: vi.fn(() => 0),
  start: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  vi.clearAllMocks();
  mockPlayer.buffer.duration = 125;
  mockPlayer.playbackRate = 1;
  mockPlayer.load.mockResolvedValue(mockPlayer);
  mockPitchShift.pitch = 0;
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
    expect(mockPlayer.load).toHaveBeenCalledWith(nextUrl);
    expect(await screen.findByText(nextUrl)).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
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

  it("updates speed and pitch controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(screen.getAllByText("1.5x")).toHaveLength(2);
    expect(mockPlayer.playbackRate).toBe(1.5);

    fireEvent.change(screen.getByLabelText(/pitch/i), {
      target: { value: "4" },
    });

    expect(screen.getByText("+4 semitones")).toBeInTheDocument();
    expect(mockPitchShift.pitch).toBe(4);
  });
});
