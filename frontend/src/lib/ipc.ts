/**
 * IPC bridge to the C++ backend via saucer.exposed functions.
 *
 * The TypeScript types for these exposed functions are generated at build time
 * from the C++ glaze definitions. For now we manually mirror the contract.
 */

/// Global saucer object injected by the native webview.
declare global {
  interface Window {
    saucer?: {
      exposed: Record<string, (...args: unknown[]) => Promise<unknown>>;
    };
  }
}

// ── Types shared with C++ backend ──────────────────────────────────────────

export interface Track {
  path: string;
  title: string;
  artist: string;
  durationSec: number;
}

export interface PlayerState {
  queue: Track[];
  currentIndex: number;
  playing: boolean;
  paused: boolean;
  positionSec: number;
}

export interface FolderTree {
  path: string;
  name: string;
  children: FolderTree[];
}

// ── IPC helper ──────────────────────────────────────────────────────────────

function call(method: string, ...args: unknown[]): Promise<unknown> {
  const fn = window.saucer?.exposed?.[method];
  if (!fn) {
    console.warn(`[ipc] saucer not ready, skipping "${method}"`);
    return Promise.resolve(null);
  }
  return fn(...args);
}

// ── Exposed API ─────────────────────────────────────────────────────────────

export function getTree(): Promise<FolderTree> {
  return call("getTree") as Promise<FolderTree>;
}

export function getTracks(dir: string): Promise<Track[]> {
  return call("getTracks", dir) as Promise<Track[]>;
}

export function playInFolder(dir: string, index: number): Promise<void> {
  return call("playInFolder", dir, index) as Promise<void>;
}

export function play(index: number): Promise<void> {
  return call("play", index) as Promise<void>;
}

export function pause(): Promise<void> {
  return call("pause") as Promise<void>;
}

export function resume(): Promise<void> {
  return call("resume") as Promise<void>;
}

export function seek(position: number): Promise<void> {
  return call("seek", position) as Promise<void>;
}

export function setVolume(volume: number): Promise<void> {
  return call("setVolume", volume) as Promise<void>;
}

export function getState(): Promise<PlayerState> {
  return call("getState") as Promise<PlayerState>;
}

export function audioEvent(
  type: string,
  position: number,
  duration: number,
): Promise<void> {
  return call("audioEvent", type, position, duration) as Promise<void>;
}

// ── Persistent state ───────────────────────────────────────────────────────

export interface SavedState {
  lastFolder: string;
  lastTrackIndex: number;
  volume: number;
  repeatMode: string;
  shuffle: boolean;
  maximized: boolean;
}

/** Retrieve saved state from disk. */
export function loadState(): Promise<SavedState> {
  return call("loadState") as Promise<SavedState>;
}

/** Persist current player state to disk. */
export function saveState(
  lastFolder: string,
  lastTrackIndex: number,
  volume: number,
  repeatMode: string,
  shuffle: boolean,
): Promise<void> {
  return call("saveState", lastFolder, lastTrackIndex, volume, repeatMode, shuffle) as Promise<void>;
}

// ── Window controls (custom title bar) ─────────────────────────────────────

export function windowMinimize(): Promise<void> {
  return call("windowMinimize") as Promise<void>;
}

export function windowMaximizeRestore(): Promise<boolean> {
  return call("windowMaximizeRestore") as Promise<boolean>;
}

export function windowClose(): Promise<void> {
  return call("windowClose") as Promise<void>;
}

export function windowStartDrag(): Promise<void> {
  return call("windowStartDrag") as Promise<void>;
}
