import { usePlayerStore } from "@/stores/playerStore";

export default function StatusBar() {
  const folderTracks = usePlayerStore((s) => s.folderTracks);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  const count = folderTracks.length;
  const folderName = currentFolder
    ? currentFolder.split("/").filter(Boolean).pop()
    : null;

  const currentTrack = currentIndex < queue.length ? queue[currentIndex] : null;

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      <span>
        {folderName ? `${folderName} — ${count} file${count !== 1 ? "s" : ""}` : "No folder selected"}
      </span>
      <span className="truncate ml-4 text-right">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>
    </div>
  );
}
