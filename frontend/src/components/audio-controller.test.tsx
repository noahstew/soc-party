import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AudioController } from "./audio-controller";
import { zingerAudio } from "@/games/zinger-audio";
import type { GameState } from "@/lib/protocol";

let audio: FakeAudio;
function fakeSource() {
  return {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}
class FakeAudio {
  state = "suspended";
  destination = {};
  volume = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  sources: ReturnType<typeof fakeSource>[] = [];
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 30 });
  createGain = () => this.volume;
  createBufferSource = () => {
    const source = fakeSource();
    this.sources.push(source);
    return source;
  };
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn().mockResolvedValue(undefined);
}
const waiting = { url: "/audio/songs/waiting.mp3", loop: true, key: "lobby" };
const state: GameState = {
  phase: "answering",
  round: 1,
  multiplierPermille: 1000,
  serverNowMs: 1000,
  players: [],
};

beforeEach(() => {
  audio = new FakeAudio();
  vi.stubGlobal("AudioContext", function () {
    return audio;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  );
});

describe("audio controller", () => {
  it("opens gear controls, changes volume, toggles mute and closes with Escape", async () => {
    render(<AudioController track={waiting} />);
    await waitFor(() => expect(audio.sources).toHaveLength(1));
    expect(audio.sources[0].loop).toBe(true);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const gear = screen.getByRole("button", { name: "Audio settings" });
    fireEvent.click(gear);
    expect(gear).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByRole("slider", { name: "Audio volume" }), {
      target: { value: "35" },
    });
    expect(audio.volume.gain.value).toBe(0.35);
    fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
    expect(audio.volume.gain.value).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Unmute audio" }));
    expect(audio.volume.gain.value).toBe(0.35);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "Escape" });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(gear).toHaveFocus();
    expect(audio.sources[0].start).toHaveBeenCalledOnce();
  });

  it("switches phases, caches songs, plays voting once and retains mute", async () => {
    const { rerender, unmount } = render(<AudioController track={waiting} />);
    await waitFor(() => expect(audio.sources).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Audio settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
    rerender(<AudioController track={zingerAudio(state)} />);
    await waitFor(() => expect(audio.sources).toHaveLength(2));
    expect(audio.sources[0].stop).toHaveBeenCalledOnce();
    expect(audio.sources[1].loop).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/audio/songs/zinger/gameplay.mp3",
      expect.anything(),
    );
    const voting = {
      ...state,
      phase: "matchup_voting" as const,
      matchupId: "a",
    };
    rerender(<AudioController track={zingerAudio(voting)} />);
    await waitFor(() => expect(audio.sources).toHaveLength(3));
    expect(audio.sources[1].stop).toHaveBeenCalledOnce();
    expect(audio.sources[2].loop).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "/audio/songs/zinger/voting.mp3",
      expect.anything(),
    );
    rerender(
      <AudioController
        track={zingerAudio({
          ...voting,
          serverNowMs: 2000,
          voteSubmitted: true,
        })}
      />,
    );
    expect(audio.sources).toHaveLength(3);
    expect(audio.sources[2].start).toHaveBeenCalledOnce();
    rerender(<AudioController track={null} />);
    expect(audio.sources[2].stop).toHaveBeenCalledOnce();
    rerender(
      <AudioController track={zingerAudio({ ...voting, matchupId: "b" })} />,
    );
    await waitFor(() => expect(audio.sources).toHaveLength(4));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(audio.volume.gain.value).toBe(0);
    expect(screen.getByRole("button", { name: "Unmute audio" })).toBeVisible();
    unmount();
    expect(audio.sources[3].stop).toHaveBeenCalledOnce();
    expect(audio.close).toHaveBeenCalledOnce();
    expect(audio.volume.disconnect).toHaveBeenCalledOnce();
    const calls = audio.resume.mock.calls.length;
    fireEvent.pointerDown(window);
    expect(audio.resume).toHaveBeenCalledTimes(calls);
  });

  it("maps final answering/voting and silences other game phases", () => {
    expect(
      zingerAudio({ ...state, phase: "final_answering", round: 3 }),
    ).toMatchObject({ loop: true, url: "/audio/songs/zinger/gameplay.mp3" });
    expect(
      zingerAudio({ ...state, phase: "final_voting", round: 3 }),
    ).toMatchObject({ loop: false, url: "/audio/songs/zinger/voting.mp3" });
    for (const phase of [
      "round_intro",
      "matchup_reveal",
      "round_scoreboard",
      "final_intro",
      "final_reveal",
      "game_over",
    ] as const) {
      expect(zingerAudio({ ...state, phase })).toBeNull();
    }
  });

  it("retries blocked autoplay on pointer and keyboard interaction", async () => {
    audio.resume.mockRejectedValueOnce(new Error("Autoplay blocked"));
    render(<AudioController track={waiting} />);
    await waitFor(() => expect(audio.sources).toHaveLength(1));
    fireEvent.pointerDown(window);
    await waitFor(() => expect(audio.state).toBe("running"));
    audio.state = "suspended";
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(audio.resume).toHaveBeenCalledTimes(3));
  });

  it("does not start a stale download after a phase change or unmount", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { rerender, unmount } = render(<AudioController track={waiting} />);
    rerender(<AudioController track={zingerAudio(state)} />);
    await waitFor(() => expect(audio.sources).toHaveLength(1));
    unmount();
    await act(async () => {
      resolve(new Response(new ArrayBuffer(8)));
    });
    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0].stop).toHaveBeenCalledOnce();
  });

  it("keeps failed audio from blocking settings or game transitions", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    const { rerender } = render(<AudioController track={waiting} />);
    await act(async () => {});
    expect(audio.sources).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Audio settings" }));
    expect(screen.getByRole("slider")).toBeVisible();
    rerender(<AudioController track={zingerAudio(state)} />);
    await waitFor(() => expect(audio.sources).toHaveLength(1));
  });
});
