import { useRef, useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import FileTree from "@/components/FileTree";
import TrackList from "@/components/TrackList";
import PlayerBar from "@/components/PlayerBar";

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

    const onEnded = () => {
      onAudioEvent("ended", el.currentTime, el.duration);
    };

    const onError = () => {
      onAudioEvent("error", el.currentTime, el.duration);
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
        el.src = `app://audio${src}`;
        el.load();
      },
      play: () => { el.play().catch(() => {}); },
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
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} preload="auto" />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border overflow-hidden">
          <FileTree />
        </aside>

        {/* Track list */}
        <main className="flex-1 overflow-hidden">
          <TrackList />
        </main>
      </div>

      {/* Bottom bar */}
      <PlayerBar />
    </div>
  );
}
