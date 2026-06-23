import { useState, useRef, useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { ArrowUpDown } from "lucide-react";
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

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Show info about the queue (playing folder), fall back to selected folder
  const ctxFolder = currentQueueFolder ?? currentFolder;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const currentTrack = currentIndex < count ? queue[currentIndex] : null;

  const sortOptions = [
    { field: null, dir: 'asc' as const, label: "Default" },
    { field: 'title' as const, dir: 'asc' as const, label: "Name ↑" },
    { field: 'title' as const, dir: 'desc' as const, label: "Name ↓" },
    { field: 'duration' as const, dir: 'asc' as const, label: "Duration ↑" },
    { field: 'duration' as const, dir: 'desc' as const, label: "Duration ↓" },
  ];

  const isActive = (field: typeof sortField, dir: typeof sortDir) =>
    sortField === field && sortDir === dir;

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      <span>
        {folderName && count > 0 ? `${folderName} — track ${currentIndex + 1}/${count}` : folderName ? `${folderName} — no tracks` : playing ? "Playing" : "No folder selected"}
      </span>
      <span className="truncate ml-4 text-right">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>

      {/* Sort popover */}
      <div className="relative shrink-0 ml-2" ref={popoverRef}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "p-1 rounded hover:text-foreground transition-colors",
            sortField && "text-primary",
          )}
        >
          <ArrowUpDown className="size-3.5" />
        </button>
        {open && (
          <div className="absolute bottom-full right-0 mb-1 w-32 bg-background border border-border rounded shadow-lg py-1 z-20">
            {sortOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setSort(opt.field, opt.dir);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors",
                  isActive(opt.field, opt.dir) && "text-primary font-medium",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
