import { useRef, useCallback, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar() {
  const playing = usePlayerStore((s) => s.playing);
  const paused = usePlayerStore((s) => s.paused);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  const togglePause = usePlayerStore((s) => s.togglePause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const changeVolume = usePlayerStore((s) => s.changeVolume);

  const [vol, setVol] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentTrack = currentIndex < queue.length ? queue[currentIndex] : null;
  const duration = currentTrack?.durationSec ?? 0;
  const progressPct = duration > 0 ? (positionSec / duration) * 100 : 0;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || duration === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * duration);
    },
    [duration, seekTo],
  );

  const handleProgressMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || duration === 0) {
        setHoverSec(null);
        return;
      }
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverSec(pct * duration);
    },
    [duration],
  );

  const handleProgressLeave = useCallback(() => {
    setHoverSec(null);
  }, []);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVol(v);
    changeVolume(muted ? 0 : v);
  };

  const toggleMute = () => {
    setMuted(!muted);
    changeVolume(muted ? vol : 0);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-black/30 px-4 py-2 shrink-0">
      {/* Controls */}
      <div className="flex items-center gap-1">
        <button onClick={prev} className="p-1 hover:text-primary transition-colors">
          <SkipBack className="size-4" />
        </button>
        <button
          onClick={togglePause}
          className="flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all"
        >
          {playing && !paused ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5 ml-0.5" />
          )}
        </button>
        <button onClick={next} className="p-1 hover:text-primary transition-colors">
          <SkipForward className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="flex-1 flex items-center gap-2 min-w-0 relative"
        onMouseMove={handleProgressMove}
        onMouseLeave={handleProgressLeave}
      >
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums shrink-0">
          {fmtTime(positionSec)}
        </span>
        <div
          ref={progressRef}
          className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-8 tabular-nums shrink-0">
          {fmtTime(duration)}
        </span>

        {/* Hover tooltip */}
        {hoverSec !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 bg-background text-foreground text-xs px-1.5 py-0.5 rounded border border-border whitespace-nowrap pointer-events-none z-10"
            style={{ left: `${(hoverSec / duration) * 100}%` }}
          >
            {fmtTime(hoverSec)}
          </div>
        )}
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={toggleMute} className="p-1 hover:text-primary transition-colors">
          {muted || vol === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : vol}
          onChange={handleVolume}
          className="w-16 accent-primary"
        />
      </div>
    </div>
  );
}
