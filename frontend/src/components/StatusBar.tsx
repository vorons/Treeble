import { usePlayerStore } from "@/stores/playerStore";
import { Repeat, Repeat1, Shuffle } from "lucide-react";
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

  const currentTrack = currentIndex < count ? queue[currentIndex] : null;

  const repeatActive = repeatMode !== "off";

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      <span>
        {folderName && count > 0
          ? `${folderName} — track ${currentIndex + 1}/${count}`
          : folderName
            ? `${folderName} — no tracks`
            : playing
              ? "Playing"
              : "No folder selected"}
      </span>

      <div className="flex items-center gap-0.5">
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

      <span className="truncate ml-4 text-right max-w-48">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>
    </div>
  );
}
