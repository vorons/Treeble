import { create } from "zustand";
import { getTree, getTracks, getState, playInFolder, play, pause, resume, nextTrack, prevTrack, seek, setVolume, audioEvent } from "@/lib/ipc";
import type { Track, FolderTree, PlayerState } from "@/lib/ipc";
import { useToastStore } from "@/stores/toastStore";

interface PlayerStore extends PlayerState {
  /** Folder tree root (loaded once at startup) */
  tree: FolderTree | null;
  /** Tracks loaded for the currently selected folder */
  folderTracks: Track[];
  /** Currently selected folder path */
  currentFolder: string | null;
  /** Which folder the playback queue belongs to (null = none) */
  currentQueueFolder: string | null;

  // ── Sorting ──
  sortField: 'title' | 'duration' | null;
  sortDir: 'asc' | 'desc';

  // ── Actions ──
  init: () => Promise<void>;
  setSort: (field: 'title' | 'duration' | null, dir: 'asc' | 'desc') => void;
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
  sortField: null,
  sortDir: 'asc',
  currentQueueFolder: null,

  init: async () => {
    try {
      const [tree] = await Promise.all([getTree()]);
      set({ tree });
    } catch (e) {
      console.error("init():", e);
      useToastStore.getState().addToast("Failed to load folder tree");
    }
  },

  selectFolder: async (dir: string) => {
    // ponytail: only updates the *display* — does NOT change the playback queue.
    // The queue stays pinned to the folder of the currently playing track.
    try {
      const tracks = await getTracks(dir);
      set({ currentFolder: dir, folderTracks: tracks });
    } catch (e) {
      console.error("selectFolder:", e);
      useToastStore.getState().addToast("Failed to load tracks from this folder");
    }
  },

  playTrack: async (index: number) => {
    const { currentFolder, folderTracks } = get();
    if (!currentFolder) return;
    try {
      // Sets the backend queue to currentFolder's tracks and plays at index.
      await playInFolder(currentFolder, index);
      set({
        playing: true,
        paused: false,
        currentIndex: index,
        positionSec: 0,
        currentQueueFolder: currentFolder,
        // Sync frontend queue so StatusBar/TrackList can read it immediately
        queue: folderTracks,
      });
    } catch (e) {
      console.error("playTrack:", e);
      useToastStore.getState().addToast("Failed to play track");
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
      useToastStore.getState().addToast("Failed to toggle playback");
    }
  },

  next: async () => {
    try {
      const { sortField, sortDir, currentQueueFolder, folderTracks, queue, currentIndex } = get();
      if (!currentQueueFolder) return;

      if (sortField) {
        const sorted = [...folderTracks].sort((a, b) => {
          const aV = sortField === 'title' ? a.title : a.durationSec;
          const bV = sortField === 'title' ? b.title : b.durationSec;
          return aV < bV ? -1 : aV > bV ? 1 : 0;
        });
        const final = sortDir === 'desc' ? sorted.reverse() : sorted;
        const cur = queue[currentIndex];
        const pos = final.findIndex((t) => t.path === cur?.path);
        if (pos < 0 || pos >= final.length - 1) return;
        const next = final[pos + 1];
        const origIdx = folderTracks.indexOf(next);
        await playInFolder(currentQueueFolder, origIdx);
        set({ currentIndex: origIdx, positionSec: 0 });
      } else {
        const idx = await nextTrack();
        set({ currentIndex: idx, positionSec: 0 });
      }
    } catch (e) {
      console.error("next:", e);
      useToastStore.getState().addToast("Failed to skip to next track");
    }
  },

  prev: async () => {
    try {
      const { sortField, sortDir, currentQueueFolder, folderTracks, queue, currentIndex } = get();
      if (!currentQueueFolder) return;

      if (sortField) {
        const sorted = [...folderTracks].sort((a, b) => {
          const aV = sortField === 'title' ? a.title : a.durationSec;
          const bV = sortField === 'title' ? b.title : b.durationSec;
          return aV < bV ? -1 : aV > bV ? 1 : 0;
        });
        const final = sortDir === 'desc' ? sorted.reverse() : sorted;
        const cur = queue[currentIndex];
        const pos = final.findIndex((t) => t.path === cur?.path);
        if (pos <= 0) return;
        const prev = final[pos - 1];
        const origIdx = folderTracks.indexOf(prev);
        await playInFolder(currentQueueFolder, origIdx);
        set({ currentIndex: origIdx, positionSec: 0 });
      } else {
        const idx = await prevTrack();
        set({ currentIndex: idx, positionSec: 0 });
      }
    } catch (e) {
      console.error("prev:", e);
      useToastStore.getState().addToast("Failed to skip to previous track");
    }
  },

  seekTo: async (sec: number) => {
    try {
      await seek(sec);
      set({ positionSec: sec });
    } catch (e) {
      console.error("seekTo:", e);
      useToastStore.getState().addToast("Failed to seek");
    }
  },

  changeVolume: async (vol: number) => {
    try {
      await setVolume(vol);
    } catch (e) {
      console.error("changeVolume:", e);
      useToastStore.getState().addToast("Failed to change volume");
    }
  },

  setSort: (field, dir) => set({ sortField: field, sortDir: dir }),

  onAudioEvent: async (type: string, pos: number, dur: number) => {
    try {
      await audioEvent(type, pos, dur);
      if (type === "timeupdate") {
        set({ positionSec: pos });
      } else if (type === "ended") {
        // Auto-advance is handled entirely by the frontend (backend does not
        // advance on "ended"). This avoids the double-advance bug that
        // occurred when the backend advanced and the frontend advanced again.
        const { sortField, sortDir, currentQueueFolder, folderTracks, queue, currentIndex } = get();
        if (sortField && currentQueueFolder) {
          // Navigate in sorted order
          const sorted = [...folderTracks].sort((a, b) => {
            const aV = sortField === 'title' ? a.title : a.durationSec;
            const bV = sortField === 'title' ? b.title : b.durationSec;
            return aV < bV ? -1 : aV > bV ? 1 : 0;
          });
          const final = sortDir === 'desc' ? sorted.reverse() : sorted;
          const cur = queue[currentIndex];
          const pos = final.findIndex((t) => t.path === cur?.path);
          if (pos >= 0 && pos < final.length - 1) {
            const next = final[pos + 1];
            const origIdx = folderTracks.indexOf(next);
            await playInFolder(currentQueueFolder, origIdx);
            set({ currentIndex: origIdx, positionSec: 0, playing: true, paused: false });
          } else {
            set({ playing: false, positionSec: 0 });
          }
        } else {
          // Queue order: advance by one if there's a next track
          if (currentIndex + 1 < queue.length) {
            const nextIdx = currentIndex + 1;
            await play(nextIdx);
            set({ currentIndex: nextIdx, positionSec: 0 });
          } else {
            set({ playing: false, positionSec: 0 });
          }
        }
      }
    } catch (e) {
      console.error("onAudioEvent:", e);
      useToastStore.getState().addToast("Playback error");
    }
  },
}));
