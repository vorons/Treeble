import { usePlayerStore } from "@/stores/playerStore";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);
  const sortField = usePlayerStore((s) => s.sortField);
  const sortDir = usePlayerStore((s) => s.sortDir);
  const setSort = usePlayerStore((s) => s.setSort);

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
        {folderName && count > 0
          ? `${folderName} — track ${currentIndex + 1}/${count}`
          : folderName
            ? `${folderName} — no tracks`
            : playing
              ? "Playing"
              : "No folder selected"}
      </span>
      <span className="truncate ml-4 text-right">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 ml-2"
          >
            <ArrowUpDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="min-w-32">
          {sortOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.label}
              onClick={() => setSort(opt.field, opt.dir)}
              className={isActive(opt.field, opt.dir) ? "text-primary font-medium" : ""}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
