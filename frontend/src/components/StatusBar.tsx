import { useCallback } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);
  const sortField = usePlayerStore((s) => s.sortField);
  const sortDir = usePlayerStore((s) => s.sortDir);
  const setSort = usePlayerStore((s) => s.setSort);

  const ctxFolder = currentQueueFolder ?? currentFolder;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const currentTrack = currentIndex < count ? queue[currentIndex] : null;

  const toggleSort = useCallback(
    (field: "title" | "duration") => {
      if (sortField === field) {
        // Toggle direction
        setSort(field, sortDir === "asc" ? "desc" : "asc");
      } else {
        // Set new field, default ascending
        setSort(field, "asc");
      }
    },
    [sortField, sortDir, setSort],
  );

  const clearSort = useCallback(() => {
    setSort(null, "asc");
  }, [setSort]);

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

      <div className="flex items-center gap-3 shrink-0 ml-4">
        {/* Sort toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSort("title")}
            className={cn(
              "flex items-center gap-0.5 hover:text-foreground transition-colors",
              sortField === "title" && "text-primary font-medium",
            )}
          >
            Name
            {sortField === "title" ? (
              sortDir === "asc" ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )
            ) : null}
          </button>
          <button
            onClick={() => toggleSort("duration")}
            className={cn(
              "flex items-center gap-0.5 hover:text-foreground transition-colors",
              sortField === "duration" && "text-primary font-medium",
            )}
          >
            Duration
            {sortField === "duration" ? (
              sortDir === "asc" ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )
            ) : null}
          </button>
          {sortField && (
            <button
              onClick={clearSort}
              className="hover:text-foreground transition-colors"
              title="Clear sort"
            >
              <ArrowUpDown className="size-3" />
            </button>
          )}
        </div>

        <span className="truncate text-right max-w-48">
          {currentTrack ? currentTrack.title : "\u00a0"}
        </span>
      </div>
    </div>
  );
}
