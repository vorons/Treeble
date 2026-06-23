import { useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import type { FolderTree as FT } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Folder, Music } from "lucide-react";

function TreeNode({ node, depth }: { node: FT; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const selectFolder = usePlayerStore((s) => s.selectFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const hasChildren = node.children.length > 0;

  const handleClick = () => {
    selectFolder(node.path);
    if (hasChildren) setExpanded(!expanded);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left text-sm hover:bg-white/5 rounded transition-colors",
          currentFolder === node.path && "bg-primary/20 text-primary",
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <Music className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export default function FileTree() {
  const tree = usePlayerStore((s) => s.tree);
  const init = usePlayerStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      <TreeNode node={tree} depth={0} />
    </div>
  );
}
