import { useRef, useCallback, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { cn } from "@/lib/utils";
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

  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMuted] = useState(false);
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolumeState(v);
    changeVolume(muted ? 0 : v);
  };

  const toggleMute = () => {
    setMuted(!muted);
    changeVolume(muted ? volume : 0);
  };

  return (
    <div className="flex items-center gap-3 border-t border-border bg-black/40 px-4 py-2">
      {/* Track info */}
      <div className="min-w-0 flex-1 max-w-[200px]">
        <div className="truncate text-sm font-medium">
          {currentTrack?.title ?? "No track"}
        </div>
        {currentTrack?.artist && (
          <div className="truncate text-xs text-muted-foreground">
            {currentTrack.artist}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button onClick={prev} className="p-1 hover:text-primary transition-colors">
          <SkipBack className="size-4" />
        </button>

        <button
          onClick={togglePause}
          className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all"
        >
          {playing && !paused ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 ml-0.5" />
          )}
        </button>

        <button onClick={next} className="p-1 hover:text-primary transition-colors">
          <SkipForward className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-10 text-right">
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

        <span className="text-xs text-muted-foreground w-10">
          {fmtTime(duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1.5">
        <button onClick={toggleMute} className="p-1 hover:text-primary transition-colors">
          {muted || volume === 0 ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-20 accent-primary"
        />
      </div>
    </div>
  );
}
