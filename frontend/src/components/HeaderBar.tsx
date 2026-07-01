import { useRef, useCallback, useState, useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { t } from "@/lib/i18n";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Minus,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  windowMinimize,
  windowMaximizeRestore,
  windowClose,
  windowStartDrag,
} from "@/lib/ipc";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HeaderBar() {
  // ── Window state ──
  const maximized = usePlayerStore((s) => s.maximized);
  const setStoreMaximized = usePlayerStore((s) => s.setMaximized);

  const handleMaxRestore = useCallback(async () => {
    const next = await windowMaximizeRestore();
    setStoreMaximized(next);
  }, [setStoreMaximized]);

  // ── Player state ──
  const playing = usePlayerStore((s) => s.playing);
  const paused = usePlayerStore((s) => s.paused);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const volume = usePlayerStore((s) => s.volume);
  const currentTrack = currentIndex < queue.length ? queue[currentIndex] : null;

  const togglePause = usePlayerStore((s) => s.togglePause);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const muted = usePlayerStore((s) => s.muted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const changeVolume = usePlayerStore((s) => s.changeVolume);

  // ── Local UI state ──
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const [hoverVol, setHoverVol] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // ── Track info / marquee ──
  const textRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    const check = () => setOverflows(el.scrollWidth > wrap.clientWidth);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [currentTrack]);

  const trackLabel = currentTrack
    ? currentTrack.artist
      ? `${currentTrack.title} — ${currentTrack.artist}`
      : currentTrack.title
    : null;

  // ── Progress bar ──
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

  // ── Volume ──
  const handleVolume = (value: number[]) => {
    changeVolume(value[0]);
  };

  // Prevent drag on interactive zones
  const noDrag = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div
      className="bg-black/30 shrink-0 select-none"
      onMouseDown={() => windowStartDrag()}
    >
      {/* Row 1: logo · track info · window controls */}
      <div className="flex items-center justify-between py-0.5">
        <span className="shrink-0 px-3 text-[11px] text-muted-foreground/50 font-mono tracking-wider leading-6">
          Treeble
        </span>

        <div
          ref={wrapRef}
          className="flex-1 min-w-0 flex items-center justify-center overflow-hidden px-4 h-6"
        >
          {trackLabel ? (
            overflows ? (
              <div className="inline-block whitespace-nowrap animate-marquee">
                <span
                  ref={textRef}
                  className="text-[11px] text-muted-foreground/70 font-medium tracking-wide"
                >
                  {trackLabel}
                </span>
                <span className="inline-block w-6" />
                <span className="text-[11px] text-muted-foreground/70 font-medium tracking-wide">
                  {trackLabel}
                </span>
              </div>
            ) : (
              <span
                ref={textRef}
                className="truncate text-[11px] text-muted-foreground/70 font-medium tracking-wide"
              >
                {trackLabel}
              </span>
            )
          ) : (
            <span className="text-[11px] text-muted-foreground/30 italic select-none">
              {t("noTrackSelected")}
            </span>
          )}
        </div>

        {/* Window controls — no drag */}
        <div className="flex items-center h-full gap-0.5 pr-1" onMouseDown={noDrag}>
          <button
            onClick={() => windowMinimize()}
            className="flex items-center justify-center size-8 rounded hover:bg-white/[0.06] transition-colors text-muted-foreground/60 hover:text-foreground/80"
            aria-label={t("minimize")}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => handleMaxRestore()}
            className="flex items-center justify-center size-8 rounded hover:bg-white/[0.06] transition-colors text-muted-foreground/60 hover:text-foreground/80"
            aria-label={maximized ? t("restore") : t("maximize")}
          >
            <Square className="size-3" />
          </button>
          <button
            onClick={() => windowClose()}
            className="flex items-center justify-center size-8 rounded hover:bg-red-500/70 hover:text-white transition-colors text-muted-foreground/60"
            aria-label={t("close")}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: controls · progress · volume — no drag */}
      <div className="flex items-center gap-3 px-4 pt-1.5 pb-3.5" onMouseDown={noDrag}>
        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prev}>
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={playing ? togglePause : () => playTrack(currentIndex)}
            className="rounded-full transition-all duration-150 hover:shadow-[0_0_14px_-2px_hsl(28,80%,52%,0.45)] active:scale-95"
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
          <div
            ref={progressRef}
            className="flex-1 h-1 bg-muted rounded-full cursor-pointer group relative overflow-hidden hover:h-1.5 transition-all duration-150"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full transition-all duration-150 ease-out"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #C85A17, #E8934A)",
                opacity: paused ? 0.5 : 1,
              }}
            />
          </div>
          {hoverSec !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 bg-background text-foreground text-xs px-1.5 py-0.5 rounded border border-border whitespace-nowrap pointer-events-none z-10"
              style={{ left: `${(hoverSec / duration) * 100}%` }}
            >
              {fmtTime(hoverSec)}
            </div>
          )}
          <span className="text-xs text-muted-foreground w-8 tabular-nums shrink-0">
            -{fmtTime(Math.max(0, duration - positionSec))}
          </span>
        </div>

        {/* Volume */}
        <div
          className="flex items-center gap-2 shrink-0 w-24 relative"
          onMouseEnter={() => setHoverVol(true)}
          onMouseLeave={() => setHoverVol(false)}
        >
          {hoverVol && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-background text-foreground text-xs px-1.5 py-0.5 rounded border border-border whitespace-nowrap pointer-events-none z-10">
              {Math.round((muted ? 0 : volume) * 100)}%
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="size-8"
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <Slider
            value={[muted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolume}
          />
        </div>
      </div>
    </div>
  );
}
