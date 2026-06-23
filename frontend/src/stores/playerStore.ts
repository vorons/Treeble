import { create } from "zustand";
import { getTree, getTracks, playInFolder, play, pause, resume, nextTrack, prevTrack, seek, setVolume, audioEvent } from "@/lib/ipc";
import type { Track, FolderTree, PlayerState } from "@/lib/ipc";
import { toast } from "sonner";

interface PlayerStore extends PlayerState {
  /** Folder tree root (loaded once at startup) */
  tree: FolderTree | null;
  /** Tracks loaded for the currently selected folder */
  folderTracks: Track[];
  /** Currently selected folder path */
  currentFolder: string | null;
  /** Which folder the playback queue belongs to (null = none) */
  currentQueueFolder: string | null;

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
  currentQueueFolder: null,

  init: async () => {
    try {
      const [tree] = await Promise.all([getTree()]);
      set({ tree });
    } catch (e) {
      console.error("init():", e);
      toast.error("Failed to load folder tree");
    }
  },

  selectFolder: async (dir: string) => {
    try {
      const tracks = await getTracks(dir);
      set({ currentFolder: dir, folderTracks: tracks });
    } catch (e) {
      console.error("selectFolder:", e);
      toast.error("Failed to load tracks from this folder");
    }
  },

  playTrack: async (index: number) => {
    const { currentFolder, folderTracks } = get();
    if (!currentFolder) return;
    try {
      await playInFolder(currentFolder, index);
      set({
        playing: true,
        paused: false,
        currentIndex: index,
        positionSec: 0,
        currentQueueFolder: currentFolder,
        queue: folderTracks,
      });
    } catch (e) {
      console.error("playTrack:", e);
      toast.error("Failed to play track");
    }
  },

  togglePause: async () => {
    try {
      const { paused } = get();
      if (paused) {
        await resume();
        set({ paused: false });
      } else {
        await pause();
        set({ paused: true });
      }
    } catch (e) {
      console.error("togglePause:", e);
      toast.error("Failed to toggle playback");
    }
  },

  next: async () => {
    try {
      const idx = await nextTrack();
      set({ currentIndex: idx, positionSec: 0 });
    } catch (e) {
      console.error("next:", e);
      toast.error("Failed to skip to next track");
    }
  },

  prev: async () => {
    try {
      const idx = await prevTrack();
      set({ currentIndex: idx, positionSec: 0 });
    } catch (e) {
      console.error("prev:", e);
      toast.error("Failed to skip to previous track");
    }
  },

  seekTo: async (sec: number) => {
    try {
      await seek(sec);
      set({ positionSec: sec });
    } catch (e) {
      console.error("seekTo:", e);
      toast.error("Failed to seek");
    }
  },

  changeVolume: async (vol: number) => {
    try {
      await setVolume(vol);
    } catch (e) {
      console.error("changeVolume:", e);
      toast.error("Failed to change volume");
    }
  },

  onAudioEvent: async (type: string, pos: number, dur: number) => {
    try {
      await audioEvent(type, pos, dur);
      if (type === "timeupdate") {
        set({ positionSec: pos });
      } else if (type === "ended") {
        const { queue, currentIndex } = get();
        if (currentIndex + 1 < queue.length) {
          const nextIdx = currentIndex + 1;
          await play(nextIdx);
          set({ currentIndex: nextIdx, positionSec: 0 });
        } else {
          set({ playing: false, positionSec: 0 });
        }
      }
    } catch (e) {
      console.error("onAudioEvent:", e);
      toast.error("Playback error");
    }
  },
}));
