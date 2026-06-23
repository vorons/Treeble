import { usePlayerStore } from "@/stores/playerStore";

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);

  // Show info about the queue (playing folder), fall back to selected folder
  const ctxFolder = currentQueueFolder ?? currentFolder;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const currentTrack = currentIndex < count ? queue[currentIndex] : null;

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      <span>
        {folderName && count > 0 ? `${folderName} — track ${currentIndex + 1}/${count}` : folderName ? `${folderName} — no tracks` : playing ? "Playing" : "No folder selected"}
      </span>
      <span className="truncate ml-4 text-right">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>
    </div>
  );
}
