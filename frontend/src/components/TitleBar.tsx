import { useState, useCallback } from "react";
import { Minus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  windowMinimize,
  windowMaximizeRestore,
  windowClose,
  windowStartDrag,
} from "@/lib/ipc";

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  const handleMaxRestore = useCallback(async () => {
    const next = await windowMaximizeRestore();
    setMaximized(next);
  }, []);

  return (
    <div className="flex items-center justify-between h-9 shrink-0 bg-black/40 select-none">
      {/* Drag region — spans the full height, buttons are excluded via grid */}
      <span
        className="flex-1 self-stretch flex items-center px-3 text-xs text-muted-foreground font-medium tracking-wide"
        onMouseDown={() => windowStartDrag()}
      >
        Treeble
      </span>

      {/* Window controls */}
      <div className="flex h-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => windowMinimize()}
          className="h-full rounded-none px-3"
          aria-label="Minimize"
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleMaxRestore()}
          className="h-full rounded-none px-3"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          <Square className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => windowClose()}
          className="h-full rounded-none px-3 hover:bg-red-500/80 hover:text-white"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
