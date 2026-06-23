import { useCallback } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
        setSort(field, sortDir === "asc" ? "desc" : "asc");
      } else {
        setSort(field, "asc");
      }
    },
    [sortField, sortDir, setSort],
  );

  const items = [
    { field: "title" as const, label: "Name" },
    { field: "duration" as const, label: "Duration" },
  ];

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
      <span className="truncate ml-4 text-right max-w-48">
        {currentTrack ? currentTrack.title : "\u00a0"}
      </span>

      {/* Sort popover */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-6 shrink-0 ml-2", sortField && "text-primary")}
          >
            {sortField ? (
              sortDir === "asc" ? (
                <ArrowUp className="size-3.5" />
              ) : (
                <ArrowDown className="size-3.5" />
              )
            ) : (
              <ArrowUpDown className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="min-w-28">
          {items.map(({ field, label }) => (
            <DropdownMenuItem
              key={field}
              onClick={() => toggleSort(field)}
              className="flex items-center justify-between gap-3"
            >
              <span>{label}</span>
              <span className="flex items-center gap-1">
                {sortField === field && (
                  <>
                    <Check className="size-3 text-primary" />
                    {sortDir === "asc" ? (
                      <ArrowUp className="size-3 text-primary" />
                    ) : (
                      <ArrowDown className="size-3 text-primary" />
                    )}
                  </>
                )}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
