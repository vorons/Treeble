import { useRef, useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import TitleBar from "@/components/TitleBar";
import FileTree from "@/components/FileTree";
import TrackList from "@/components/TrackList";
import PlayerBar from "@/components/PlayerBar";
import StatusBar from "@/components/StatusBar";

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

  return (
    <div className="flex flex-col h-dvh">
      <audio ref={audioRef} preload="auto" />

      {/* Custom title bar */}
      <TitleBar />

      {/* Top bar: controls, progress, volume */}
      <PlayerBar />

      {/* Main area: sidebar + tracks */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r border-border overflow-hidden">
          <FileTree />
        </aside>

        <main className="flex-1 overflow-hidden">
          <TrackList />
        </main>
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
  );
}
