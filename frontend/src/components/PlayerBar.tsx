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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

  const handleVolume = (value: number[]) => {
    const v = value[0];
    setVol(v);
    setMuted(false);
    changeVolume(v);
  };

  const toggleMute = () => {
    setMuted(!muted);
    changeVolume(muted ? vol : 0);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-black/30 px-4 py-2 shrink-0">
      {/* Controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={prev}>
          <SkipBack className="size-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={togglePause}
          className="rounded-full"
        >
          {playing && !paused ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5 ml-0.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={next}>
          <SkipForward className="size-4" />
        </Button>
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
        <Tooltip open={hoverSec !== null}>
          <TooltipTrigger asChild>
            <div
              ref={progressRef}
              className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer group relative overflow-hidden"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            style={{ left: `${(hoverSec! / duration) * 100}%` }}
          >
            {fmtTime(hoverSec ?? 0)}
          </TooltipContent>
        </Tooltip>
        <span className="text-xs text-muted-foreground w-8 tabular-nums shrink-0">
          {fmtTime(duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 shrink-0 w-24">
        <Button variant="ghost" size="icon" onClick={toggleMute} className="size-8">
          {muted || vol === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <Slider
          value={[muted ? 0 : vol]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={handleVolume}
        />
      </div>
    </div>
  );
}
