import { create } from "zustand";
import { getTree, getTracks, getState, play, pause, resume, nextTrack, prevTrack, seek, setVolume, audioEvent } from "@/lib/ipc";
import type { Track, FolderTree, PlayerState } from "@/lib/ipc";

interface PlayerStore extends PlayerState {
  /** Folder tree root (loaded once at startup) */
  tree: FolderTree | null;
  /** Tracks loaded for the currently selected folder */
  folderTracks: Track[];
  /** Currently selected folder path */
  currentFolder: string | null;

  // ── Actions ──
  init: () => Promise<void>;
  selectFolder: (dir: string) => Promise<void>;
  playTrack: (index: number) => Promise<void>;
  togglePause: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seekTo: (sec: number) => Promise<void>;
  changeVolume: (vol: number) => Promise<void>;
  onAudioEvent: (type: string, pos: number, dur: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // initial state
  queue: [],
  currentIndex: 0,
  playing: false,
  paused: false,
  positionSec: 0,
  tree: null,
  folderTracks: [],
  currentFolder: null,

  init: async () => {
    const [tree] = await Promise.all([getTree()]);
    set({ tree });
  },

  selectFolder: async (dir: string) => {
    const tracks = await getTracks(dir);
    set({ currentFolder: dir, folderTracks: tracks });
  },

  playTrack: async (index: number) => {
    // Calculate global queue index
    const { queue, folderTracks, currentFolder } = get();
    const queueStart = queue.length - folderTracks.length;
    // If the current folder changed, we need to find the right global index
    // ponytail: assumes selectFolder was called just before; tracks are appended
    // to queue in order. A more robust approach would index by track path.
    await play(index);
    set({ playing: true, paused: false, currentIndex: index });
  },

  togglePause: async () => {
    const { paused } = get();
    if (paused) {
      await resume();
      set({ paused: false });
    } else {
      await pause();
      set({ paused: true });
    }
  },

  next: async () => {
    await nextTrack();
  },

  prev: async () => {
    await prevTrack();
  },

  seekTo: async (sec: number) => {
    await seek(sec);
    set({ positionSec: sec });
  },

  changeVolume: async (vol: number) => {
    await setVolume(vol);
  },

  onAudioEvent: (type: string, pos: number, dur: number) => {
    audioEvent(type, pos, dur); // fire-and-forget to backend
    if (type === "timeupdate") {
      set({ positionSec: pos });
    }
  },
}));
