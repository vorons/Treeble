import { create } from "zustand";
import { getTree, getTracks, playInFolder, play, pause, resume, nextTrack, prevTrack, seek, setVolume, audioEvent } from "@/lib/ipc";
import type { Track, FolderTree, PlayerState } from "@/lib/ipc";
import { toast } from "sonner";

type RepeatMode = 'off' | 'one' | 'folder';

interface PlayerStore extends PlayerState {
  /** Folder tree root (loaded once at startup) */
  tree: FolderTree | null;
  /** Tracks loaded for the currently selected folder */
  folderTracks: Track[];
  /** Currently selected folder path */
  currentFolder: string | null;
  /** Which folder the playback queue belongs to (null = none) */
  currentQueueFolder: string | null;

  // ── Repeat / Shuffle ──
  repeatMode: RepeatMode;
  shuffle: boolean;
  /** Random permutation of queue indices — only used when shuffle is on */
  shuffleOrder: number[];
  /** Current position inside shuffleOrder */
  shuffleIdx: number;

  // ── Actions ──
  init: () => Promise<void>;
  selectFolder: (dir: string) => Promise<void>;
  playTrack: (index: number) => Promise<void>;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  togglePause: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seekTo: (sec: number) => Promise<void>;
  changeVolume: (vol: number) => Promise<void>;
  onAudioEvent: (type: string, pos: number, dur: number) => void;
  /** @internal rebuild shuffle order after queue change */
  _rebuildShuffleOrder: (currentIdx: number) => void;
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
  repeatMode: 'off',
  shuffle: false,
  shuffleOrder: [],
  shuffleIdx: 0,

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
      // (re-)generate shuffle order so the current track is at position 0
      get()._rebuildShuffleOrder(index);
    } catch (e) {
      console.error("playTrack:", e);
      toast.error("Failed to play track");
    }
  },

  cycleRepeat: () => {
    const { repeatMode } = get();
    const next: Record<RepeatMode, RepeatMode> = { off: 'one', one: 'folder', folder: 'off' };
    set({ repeatMode: next[repeatMode] });
  },

  toggleShuffle: () => {
    const { shuffle, currentIndex, queue } = get();
    if (shuffle) {
      set({ shuffle: false, shuffleOrder: [], shuffleIdx: 0 });
      return;
    }
    const n = queue.length;
    const order = Array.from({ length: n }, (_, i) => i);
    // Fisher-Yates shuffle everything
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Put currentIndex at position 0 so the current track stays
    const idxOfCurrent = order.indexOf(currentIndex);
    [order[0], order[idxOfCurrent]] = [order[idxOfCurrent], order[0]];
    set({ shuffle: true, shuffleOrder: order, shuffleIdx: 0 });
  },

  /** helper to rebuild shuffle order after queue changes */
  _rebuildShuffleOrder: (currentIdx: number) => {
    const { shuffle, queue } = get();
    if (!shuffle) return;
    const n = queue.length;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const idx = order.indexOf(currentIdx);
    [order[0], order[idx]] = [order[idx], order[0]];
    set({ shuffleOrder: order, shuffleIdx: 0 });
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
    const { queue, currentIndex, shuffle, shuffleOrder, shuffleIdx, repeatMode } = get();
    const n = queue.length;
    if (n === 0) return;

    let nextIdx: number;
    if (shuffle) {
      const nextShuffleIdx = shuffleIdx + 1;
      if (nextShuffleIdx < n) {
        nextIdx = shuffleOrder[nextShuffleIdx];
        set({ shuffleIdx: nextShuffleIdx });
      } else if (repeatMode === 'folder') {
        nextIdx = shuffleOrder[0];
        set({ shuffleIdx: 0 });
      } else {
        return;
      }
    } else {
      const next = currentIndex + 1;
      if (next < n) {
        nextIdx = next;
      } else if (repeatMode === 'folder') {
        nextIdx = 0;
      } else {
        return;
      }
    }

    try {
      await play(nextIdx);
      set({ currentIndex: nextIdx, positionSec: 0 });
    } catch (e) {
      console.error("next:", e);
      toast.error("Failed to skip to next track");
    }
  },

  prev: async () => {
    const { queue, currentIndex, shuffle, shuffleOrder, shuffleIdx, repeatMode } = get();
    const n = queue.length;
    if (n === 0) return;

    let prevIdx: number;
    if (shuffle) {
      const prevShuffleIdx = shuffleIdx - 1;
      if (prevShuffleIdx >= 0) {
        prevIdx = shuffleOrder[prevShuffleIdx];
        set({ shuffleIdx: prevShuffleIdx });
      } else if (repeatMode === 'folder') {
        prevIdx = shuffleOrder[n - 1];
        set({ shuffleIdx: n - 1 });
      } else {
        return;
      }
    } else {
      const prev = currentIndex - 1;
      if (prev >= 0) {
        prevIdx = prev;
      } else if (repeatMode === 'folder') {
        prevIdx = n - 1;
      } else {
        return;
      }
    }

    try {
      await play(prevIdx);
      set({ currentIndex: prevIdx, positionSec: 0 });
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
        const { queue, currentIndex, repeatMode, shuffle, shuffleOrder, shuffleIdx } = get();
        const n = queue.length;
        if (n === 0) { set({ playing: false, positionSec: 0 }); return; }

        if (repeatMode === 'one') {
          // replay same track
          await play(currentIndex);
          set({ positionSec: 0 });
          return;
        }

        let nextIdx: number;
        if (shuffle) {
          const nextShuffleIdx = shuffleIdx + 1;
          if (nextShuffleIdx < n) {
            nextIdx = shuffleOrder[nextShuffleIdx];
            set({ shuffleIdx: nextShuffleIdx });
          } else if (repeatMode === 'folder') {
            nextIdx = shuffleOrder[0];
            set({ shuffleIdx: 0 });
          } else {
            set({ playing: false, positionSec: 0 });
            return;
          }
        } else {
          const next = currentIndex + 1;
          if (next < n) {
            nextIdx = next;
          } else if (repeatMode === 'folder') {
            nextIdx = 0;
          } else {
            set({ playing: false, positionSec: 0 });
            return;
          }
        }

        await play(nextIdx);
        set({ currentIndex: nextIdx, positionSec: 0 });
      }
    } catch (e) {
      console.error("onAudioEvent:", e);
      toast.error("Playback error");
    }
  },
}));
