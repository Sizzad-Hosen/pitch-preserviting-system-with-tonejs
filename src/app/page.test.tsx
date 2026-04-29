import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mockPlayer = {
  buffer: { duration: 125 },
  connect: vi.fn(),
  dispose: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  playbackRate: 1,
  volume: { value: -4 },
};

const mockPitchShift = {
  dispose: vi.fn(),
  toDestination: vi.fn(() => mockPitchShift),
  pitch: 0,
};

vi.mock("tone", () => ({
  Destination: "destination",
  GrainPlayer: vi.fn(function GrainPlayer() {
    return mockPlayer;
  }),
  PitchShift: vi.fn(function PitchShift() {
    return mockPitchShift;
  }),
  loaded: vi.fn(() => Promise.resolve()),
  now: vi.fn(() => 0),
  start: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  vi.clearAllMocks();
  mockPlayer.buffer.duration = 125;
  mockPlayer.playbackRate = 1;
  mockPlayer.volume.value = -4;
  mockPitchShift.pitch = 0;
});

describe("Home audio player", () => {
  it("renders the audio player with playback disabled before upload", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /learning audio player/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/waiting for audio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
    expect(screen.getByLabelText(/playback position/i)).toBeDisabled();
  });

  it("loads an uploaded audio file and enables playback controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const file = new File(["audio"], "lesson.mp3", { type: "audio/mpeg" });
    await user.upload(screen.getByLabelText(/upload audio/i), file);

    expect(await screen.findByText("lesson.mp3")).toBeInTheDocument();
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
    expect(screen.getByText("0:00 / 2:05")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeEnabled();
    expect(screen.getByLabelText(/playback position/i)).toBeEnabled();
  });

  it("updates tempo from preset buttons and slider", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(screen.getAllByText("1.50x")).toHaveLength(2);

    fireEvent.change(screen.getByLabelText(/tempo/i), {
      target: { value: "0.75" },
    });

    await waitFor(() => {
      expect(screen.getAllByText("0.75x")).toHaveLength(3);
    });
  });

  it("updates pitch and volume readouts", async () => {
    render(<Home />);

    fireEvent.change(screen.getByLabelText(/pitch shift/i), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText(/volume/i), {
      target: { value: "-12" },
    });

    expect(screen.getByText("+5 st")).toBeInTheDocument();
    expect(screen.getAllByText("-12 dB")).toHaveLength(2);
  });
});
