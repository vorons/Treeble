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
        <button
          onClick={() => windowMinimize()}
          className="px-3 h-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Minimize"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          onClick={() => handleMaxRestore()}
          className="px-3 h-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          <Square className="size-3" />
        </button>
        <button
          onClick={() => windowClose()}
          className="px-3 h-full hover:bg-red-500/80 hover:text-white transition-colors text-muted-foreground"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
