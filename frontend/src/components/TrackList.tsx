import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { cn } from "@/lib/utils";
import { Play, Pause, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Track } from "@/lib/ipc";

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
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePause = usePlayerStore((s) => s.togglePause);
  const activeRef = useRef<HTMLDivElement>(null);

  // Scroll active track into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  if (!currentFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Music className="size-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-base text-foreground font-medium">Select a folder from the tree</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a folder to browse its music files</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border text-muted-foreground">Space</kbd>
          <span className="text-xs text-muted-foreground self-center">Play / Pause</span>
          <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border text-muted-foreground">←</kbd>
          <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border text-muted-foreground">→</kbd>
          <span className="text-xs text-muted-foreground self-center">Seek</span>
        </div>
      </div>
    );
  }

  const isCurrentTrack = (track: Track) => {
    if (queue.length === 0 || currentFolder !== currentQueueFolder) return false;
    return queue[currentIndex]?.path === track.path;
  };

  return (
    <ScrollArea className="h-full">
      <div>
        {folderTracks.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No audio files in this folder.
          </div>
        )}
        {folderTracks.map((track) => {
          const active = isCurrentTrack(track);
          const origIdx = folderTracks.indexOf(track);
          return (
            <div
              key={track.path}
              ref={active ? activeRef : undefined}
              className={cn(
                "group flex items-center gap-3 px-4 py-2 hover:bg-amber-500/5 cursor-pointer transition-colors border-l-2",
                active && !paused && "border-primary bg-amber-500/[0.03]",
                active && paused && "border-primary/70 bg-amber-500/[0.03]",
                !active && "border-transparent",
              )}
              onDoubleClick={() => playTrack(origIdx)}
            >
              {/* Play button */}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() =>
                  active && playing ? togglePause() : playTrack(origIdx)
                }
              >
                {active && playing && !paused ? (
                  <Pause className="size-3.5 text-primary" />
                ) : (
                  <Play className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                )}
              </Button>

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
    </ScrollArea>
  );
}
