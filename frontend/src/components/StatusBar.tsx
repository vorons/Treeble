import { useCallback } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function SortPopover() {
  const sortField = usePlayerStore((s) => s.sortField);
  const sortDir = usePlayerStore((s) => s.sortDir);
  const setSort = usePlayerStore((s) => s.setSort);
  const [open, setOpen] = useState(false);

  const toggleSort = useCallback(
    (field: "title" | "duration") => {
      if (sortField === field) {
        setSort(field, sortDir === "asc" ? "desc" : "asc");
      } else {
        setSort(field, "asc");
      }
      setOpen(false);
    },
    [sortField, sortDir, setSort],
  );

  const items = [
    { field: "title" as const, label: "Name" },
    { field: "duration" as const, label: "Duration" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="min-w-28 p-1.5">
        <div className="flex flex-col gap-0.5">
          {items.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-xs text-left",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                sortField === field && "text-primary font-medium",
              )}
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
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);

  const ctxFolder = currentQueueFolder ?? currentFolder;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const currentTrack = currentIndex < count ? queue[currentIndex] : null;

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
      <SortPopover />
    </div>
  );
}
