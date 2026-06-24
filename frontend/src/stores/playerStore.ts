import { create } from "zustand";
import {
  getTree,
  getTracks,
  playInFolder,
  play,
  pause,
  resume,
  seek,
  setVolume,
  audioEvent,
  loadState,
  saveState,
} from "@/lib/ipc";
import type { Track, FolderTree } from "@/lib/ipc";
import { toast } from "sonner";

type RepeatMode = "off" | "one" | "folder";

interface PlayerStore {
  // ── Playback state ──
  queue: Track[];
  currentIndex: number;
  playing: boolean;
  paused: boolean;
  positionSec: number;

  // ── Folder tree ──
  tree: FolderTree | null;
  folderTracks: Track[];
  currentFolder: string | null;
  currentQueueFolder: string | null;

  // ── Repeat / Shuffle ──
  repeatMode: RepeatMode;
  shuffle: boolean;
  shuffleOrder: number[];
  shuffleIdx: number;

  // ── Volume (persisted) ──
  volume: number;
  muted: boolean;
  _preMuteVolume: number;

  // ── Window (persisted) ──
  maximized: boolean;

  // ── Tree expansion (persisted) ──
  expandedPaths: Set<string>;

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
  setMaximized: (val: boolean) => void;
  toggleMute: () => void;
  changeVolume: (vol: number) => Promise<void>;
  setExpanded: (path: string, expanded: boolean) => void;
  onAudioEvent: (type: string, pos: number, dur: number) => void;
  _rebuildShuffleOrder: (currentIdx: number) => void;
  _saveState: () => Promise<void>;
  _loadAndApplyState: () => Promise<void>;
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
  repeatMode: "off" as RepeatMode,
  shuffle: false,
  shuffleOrder: [],
  shuffleIdx: 0,
  volume: 0.7,
  muted: false,
  _preMuteVolume: 0.7,
  maximized: false,
  expandedPaths: new Set<string>(),

  // ── Init ──────────────────────────────────────────────────────────────────
  init: async () => {
    try {
      const [tree] = await Promise.all([getTree()]);
      set({ tree });
      // Restore saved state after tree is loaded
      await get()._loadAndApplyState();
    } catch (e) {
      console.error("init():", e);
      toast.error("Failed to load folder tree");
    }
  },

  // ── Folder selection ──────────────────────────────────────────────────────
  selectFolder: async (dir: string) => {
    try {
      const tracks = await getTracks(dir);
      set({ currentFolder: dir, folderTracks: tracks });
      get()._saveState();
    } catch (e) {
      console.error("selectFolder:", e);
      toast.error("Failed to load tracks from this folder");
    }
  },

  // ── Track playback ────────────────────────────────────────────────────────
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
      get()._rebuildShuffleOrder(index);
      get()._saveState();
    } catch (e) {
      console.error("playTrack:", e);
      toast.error("Failed to play track");
    }
  },

  // ── Repeat / Shuffle ─────────────────────────────────────────────────────
  cycleRepeat: () => {
    const { repeatMode } = get();
    const next: Record<RepeatMode, RepeatMode> = {
      off: "one",
      one: "folder",
      folder: "off",
    };
    set({ repeatMode: next[repeatMode] });
    get()._saveState();
  },

  toggleShuffle: () => {
    const { shuffle, currentIndex, queue } = get();
    if (shuffle) {
      set({ shuffle: false, shuffleOrder: [], shuffleIdx: 0 });
      get()._saveState();
      return;
    }
    const n = queue.length;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const idxOfCurrent = order.indexOf(currentIndex);
    [order[0], order[idxOfCurrent]] = [order[idxOfCurrent], order[0]];
    set({ shuffle: true, shuffleOrder: order, shuffleIdx: 0 });
    get()._saveState();
  },

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

  // ── Playback controls ────────────────────────────────────────────────────
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
    const {
      queue,
      currentIndex,
      shuffle,
      shuffleOrder,
      shuffleIdx,
      repeatMode,
    } = get();
    const n = queue.length;
    if (n === 0) return;

    let nextIdx: number;
    if (shuffle) {
      const nextShuffleIdx = shuffleIdx + 1;
      if (nextShuffleIdx < n) {
        nextIdx = shuffleOrder[nextShuffleIdx];
        set({ shuffleIdx: nextShuffleIdx });
      } else if (repeatMode === "folder") {
        nextIdx = shuffleOrder[0];
        set({ shuffleIdx: 0 });
      } else {
        return;
      }
    } else {
      const next = currentIndex + 1;
      if (next < n) {
        nextIdx = next;
      } else if (repeatMode === "folder") {
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
    const {
      queue,
      currentIndex,
      shuffle,
      shuffleOrder,
      shuffleIdx,
      repeatMode,
    } = get();
    const n = queue.length;
    if (n === 0) return;

    let prevIdx: number;
    if (shuffle) {
      const prevShuffleIdx = shuffleIdx - 1;
      if (prevShuffleIdx >= 0) {
        prevIdx = shuffleOrder[prevShuffleIdx];
        set({ shuffleIdx: prevShuffleIdx });
      } else if (repeatMode === "folder") {
        prevIdx = shuffleOrder[n - 1];
        set({ shuffleIdx: n - 1 });
      } else {
        return;
      }
    } else {
      const prev = currentIndex - 1;
      if (prev >= 0) {
        prevIdx = prev;
      } else if (repeatMode === "folder") {
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

  toggleMute: () => {
    const { muted, volume } = get();
    if (muted) {
      const restoreVol = get()._preMuteVolume;
      get().changeVolume(restoreVol);
    } else {
      set({ _preMuteVolume: volume, muted: true });
      get().changeVolume(0);
    }
  },

  changeVolume: async (vol: number) => {
    try {
      await setVolume(vol);
      set({ volume: vol, muted: vol === 0 ? get().muted : false });
      get()._saveState();
    } catch (e) {
      console.error("changeVolume:", e);
      toast.error("Failed to change volume");
    }
  },

  setMaximized: (val: boolean) => {
    set({ maximized: val });
  },

  setExpanded: (path: string, expanded: boolean) => {
    const { expandedPaths } = get();
    const next = new Set(expandedPaths);
    if (expanded) {
      next.add(path);
    } else {
      next.delete(path);
    }
    set({ expandedPaths: next });
  },

  // ── Audio events ─────────────────────────────────────────────────────────
  onAudioEvent: async (type: string, pos: number, dur: number) => {
    try {
      await audioEvent(type, pos, dur);
      if (type === "timeupdate") {
        set({ positionSec: pos });
      } else if (type === "ended") {
        const {
          queue,
          currentIndex,
          repeatMode,
          shuffle,
          shuffleOrder,
          shuffleIdx,
        } = get();
        const n = queue.length;
        if (n === 0) {
          set({ playing: false, positionSec: 0 });
          return;
        }

        if (repeatMode === "one") {
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
          } else if (repeatMode === "folder") {
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
          } else if (repeatMode === "folder") {
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

  // ── State persistence ────────────────────────────────────────────────────
  _saveState: async () => {
    const { currentFolder, currentQueueFolder, currentIndex, volume, repeatMode, shuffle } = get();
    console.log("[state] _saveState volume:", volume);
    try {
      await saveState(
        currentFolder ?? "",
        currentQueueFolder === currentFolder ? currentIndex : 0,
        volume,
        repeatMode,
        shuffle,
      );
    } catch (e) {
      console.error("_saveState:", e);
    }
  },

  _loadAndApplyState: async () => {
    try {
      const s = await loadState();
      console.log("[state] loadState returned:", JSON.stringify(s));
      if (!s) return;
      const lastFolder = s.lastFolder ?? "";
      const lastTrackIndex = s.lastTrackIndex ?? 0;
      const volume = s.volume ?? 0.7;
      const repeatMode = s.repeatMode ?? "off";
      const shuffle = s.shuffle ?? false;
      console.log("[state] applying volume:", volume);

      // Apply volume
      set({ volume, repeatMode: repeatMode as RepeatMode, shuffle });

      // Sync volume to audio element
      const player = (window as unknown as Record<string, any>).audioPlayer;
      if (player) {
        player.setVolume(volume);
      }

      // Apply repeat/shuffle to the native backend side-effect-free (setters)
      // (no IPC needed for these — they're frontend-only state)

      // Load last folder
      if (s.maximized) {
        set({ maximized: true });
      }

      if (lastFolder) {
        const tracks = await getTracks(lastFolder);
        set({
          currentFolder: lastFolder,
          currentQueueFolder: lastFolder,
          folderTracks: tracks,
          queue: tracks,
          currentIndex: Math.min(lastTrackIndex, tracks.length - 1),
        });

        // Build expanded paths: all ancestors of lastFolder
        const parts = lastFolder.split("/").filter(Boolean);
        const expanded = new Set<string>();
        let acc = "";
        for (const p of parts) {
          acc += "/" + p;
          if (acc !== lastFolder) {
            expanded.add(acc);
          }
        }
        set({ expandedPaths: expanded });
      }
    } catch (e) {
      console.error("_loadAndApplyState:", e);
    }
  },
}));
