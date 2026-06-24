import { useRef, useEffect, useCallback, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import HeaderBar from "@/components/HeaderBar";
import FileTree from "@/components/FileTree";
import TrackList from "@/components/TrackList";
import StatusBar from "@/components/StatusBar";

const DEFAULT_SIDEBAR_WIDTH = 224; // w-56
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_PCT = 0.5;

function SidebarResizer() {
  const [w, setW] = useSidebarWidth();
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startW = w;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const maxW = window.innerWidth * MAX_SIDEBAR_PCT;
      const next = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxW, startW + ev.clientX - startX));
      setW(next);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [w, setW]);

  return (
    <>
      <aside className="shrink-0 border-r border-border overflow-hidden" style={{ width: w }}>
        <FileTree />
      </aside>
      {/* resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/40 active:bg-primary/60 transition-colors relative -ml-px z-10"
      />
    </>
  );
}

function useSidebarWidth() {
  const [w, setW] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? Number(saved) : DEFAULT_SIDEBAR_WIDTH;
  });
  const setWidth = useCallback((px: number) => {
    setW(px);
    localStorage.setItem("sidebarWidth", String(px));
  }, []);
  return [w, setWidth] as const;
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const onAudioEvent = usePlayerStore((s) => s.onAudioEvent);

  // Wire up HTML5 audio element events → C++ backend
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      onAudioEvent("timeupdate", el.currentTime, el.duration);
    };

    const safeDur = () => Number.isFinite(el.duration) ? el.duration : 0;
    const safePos = () => Number.isFinite(el.currentTime) ? el.currentTime : 0;

    const onEnded = () => {
      onAudioEvent("ended", safePos(), safeDur());
    };

    const onError = () => {
      const mediaErr = el.error;
      const code = mediaErr?.code ?? -1;
      const msg = mediaErr?.message ?? "unknown";
      console.error(`[audio] error event code=${code} message=${msg}`);
      onAudioEvent("error", safePos(), safeDur());
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [onAudioEvent]);

  // Expose audio player to C++ backend (WebViewAudioBackend calls these)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    (window as unknown as Record<string, unknown>).audioPlayer = {
      load: (src: string) => {
        const base = (window as any).__audioBaseURL || 'http://127.0.0.1:0';
        el.src = `${base}/audio${src}`;
        el.load();
      },
      play: () => {
        el.play().catch((e) => { console.error("[audio] play error:", e); });
      },
      pause: () => { el.pause(); },
      seek: (sec: number) => { el.currentTime = sec; },
      setVolume: (vol: number) => { el.volume = vol; },
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).audioPlayer;
    };
  }, []);

  // ── Keyboard shortcuts ──
  const playing = usePlayerStore((s) => s.playing);
  const togglePause = usePlayerStore((s) => s.togglePause);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const volume = usePlayerStore((s) => s.volume);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const changeVolume = usePlayerStore((s) => s.changeVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (playing) {
            togglePause();
          } else {
            playTrack(currentIndex);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.ctrlKey) {
            prev();
          } else {
            seekTo(Math.max(0, positionSec - 5));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.ctrlKey) {
            next();
          } else {
            const dur = currentIndex < queue.length ? queue[currentIndex].durationSec : 0;
            seekTo(Math.min(dur, positionSec + 5));
          }
          break;
        case "ArrowUp":
          if (e.ctrlKey) {
            e.preventDefault();
            changeVolume(Math.min(1, volume + 0.1));
          }
          break;
        case "ArrowDown":
          if (e.ctrlKey) {
            e.preventDefault();
            changeVolume(Math.max(0, volume - 0.1));
          }
          break;
        case "KeyM":
          if (e.ctrlKey) {
            e.preventDefault();
            toggleMute();
          }
          break;
      }
    },
    [playing, togglePause, playTrack, seekTo, positionSec, volume, queue, currentIndex, next, prev, changeVolume, toggleMute],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-dvh select-none" onContextMenu={(e) => e.preventDefault()}>
        <audio ref={audioRef} preload="auto" />

        {/* Header bar: title bar + player controls merged */}
        <HeaderBar />

        {/* Main area: sidebar + tracks */}
        <div className="flex flex-1 min-h-0">
          <SidebarResizer />

          <main className="flex-1 overflow-hidden">
            <TrackList />
          </main>
        </div>

        {/* Bottom status bar */}
        <StatusBar />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
