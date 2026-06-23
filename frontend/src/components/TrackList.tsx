import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { cn } from "@/lib/utils";
import { Play, Pause } from "lucide-react";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackList() {
  const folderTracks = usePlayerStore((s) => s.folderTracks);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const playing = usePlayerStore((s) => s.playing);
  const paused = usePlayerStore((s) => s.paused);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const selectFolder = usePlayerStore((s) => s.selectFolder);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePause = usePlayerStore((s) => s.togglePause);
  const activeRef = useRef<HTMLDivElement>(null);

  // Scroll active track into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  if (!currentFolder) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select a folder from the tree
      </div>
    );
  }

  const isCurrentTrack = (idx: number) => {
    // ponytail: simple offset check; works when tracks are loaded sequentially
    return idx === currentIndex && queue.length > 0;
  };

  return (
    <div className="h-full overflow-y-auto">
      {folderTracks.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">
          No audio files in this folder.
        </div>
      )}
      {folderTracks.map((track, idx) => {
        const active = isCurrentTrack(idx);
        return (
          <div
            key={track.path}
            ref={active ? activeRef : undefined}
            className={cn(
              "group flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer transition-colors",
              active && "bg-primary/10",
            )}
            onDoubleClick={() => playTrack(idx)}
          >
            {/* Play button */}
            <button
              onClick={() =>
                active && playing ? togglePause() : playTrack(idx)
              }
              className="size-6 shrink-0 flex items-center justify-center"
            >
              {active && playing && !paused ? (
                <Pause className="size-3.5 text-primary" />
              ) : (
                <Play className="size-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "truncate text-sm",
                  active && "text-primary font-medium",
                )}
              >
                {track.title}
              </div>
              {track.artist && (
                <div className="truncate text-xs text-muted-foreground">
                  {track.artist}
                </div>
              )}
            </div>

            {/* Duration */}
            <span className="text-xs text-muted-foreground shrink-0">
              {fmtDuration(track.durationSec)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
