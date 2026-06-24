import { usePlayerStore } from "@/stores/playerStore";
import { Folder, Repeat, Repeat1, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const ctxFolder = currentQueueFolder ?? currentFolder;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const repeatActive = repeatMode !== "off";

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      {/* Left: folder icon + folder/track info */}
      <span className="truncate flex items-center gap-1.5 min-w-0">
        {folderName && count > 0 ? (
          <>
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">
              <span className="font-medium">{folderName}</span>
              <span className="mx-1.5 text-muted-foreground">—</span>
              <span className="tabular-nums">{currentIndex + 1}/{count}</span>
            </span>
          </>
        ) : folderName ? (
          <>
            <Folder className="size-3.5 shrink-0" />
            {folderName}
          </>
        ) : playing ? (
          "Playing"
        ) : (
          "No folder selected"
        )}
      </span>

      {/* Right: repeat + shuffle */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Repeat icon — 3-state cycle */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 ${repeatActive ? "text-primary" : ""}`}
          onClick={cycleRepeat}
          title={
            repeatMode === "off"
              ? "Repeat off"
              : repeatMode === "one"
                ? "Repeat one"
                : "Repeat folder"
          }
        >
          {repeatMode === "one" ? <Repeat1 className="size-3.5" /> : <Repeat className="size-3.5" />}
        </Button>

        {/* Shuffle icon — toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 ${shuffle ? "text-primary" : ""}`}
          onClick={toggleShuffle}
          title={shuffle ? "Shuffle on" : "Shuffle off"}
        >
          <Shuffle className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
