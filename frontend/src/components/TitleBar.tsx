import { useState, useCallback } from "react";
import { Minus, Square, X } from "lucide-react";
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
    <div className="flex items-center justify-between shrink-0 bg-black/30 select-none py-1">
      {/* Drag region */}
      <span
        className="flex-1 self-stretch flex items-center px-3 text-[11px] text-muted-foreground/50 font-mono tracking-wider"
        onMouseDown={() => windowStartDrag()}
      >
        Treeble
      </span>

      {/* Window controls */}
      <div className="flex items-center h-full gap-0.5 pr-1">
        <button
          onClick={() => windowMinimize()}
          className="flex items-center justify-center size-6 rounded hover:bg-white/[0.06] transition-colors text-muted-foreground/60 hover:text-foreground/80"
          aria-label="Minimize"
        >
          <Minus className="size-3" />
        </button>
        <button
          onClick={() => handleMaxRestore()}
          className="flex items-center justify-center size-6 rounded hover:bg-white/[0.06] transition-colors text-muted-foreground/60 hover:text-foreground/80"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          <Square className="size-2.5" />
        </button>
        <button
          onClick={() => windowClose()}
          className="flex items-center justify-center size-6 rounded hover:bg-red-500/70 hover:text-white transition-colors text-muted-foreground/60"
          aria-label="Close"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}
