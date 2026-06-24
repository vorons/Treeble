import { useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import type { FolderTree as FT } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Folder, Music } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

function TreeNode({ node, depth }: { node: FT; depth: number }) {
  const expandedPaths = usePlayerStore((s) => s.expandedPaths);
  const setExpanded = usePlayerStore((s) => s.setExpanded);
  const selectFolder = usePlayerStore((s) => s.selectFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const isQueueFolder = currentQueueFolder === node.path;
  const hasChildren = node.children.length > 0;
  const expanded = expandedPaths.has(node.path);

  const handleClick = () => {
    selectFolder(node.path);
    if (hasChildren) setExpanded(node.path, !expanded);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left text-sm hover:bg-amber-500/5 transition-colors border-l-2",
          currentFolder === node.path && "border-primary bg-amber-500/[0.03] text-primary",
          !(currentFolder === node.path) && "border-transparent",
          isQueueFolder && "font-medium",
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className={cn("flex items-center", !hasChildren && "invisible")}>
          {expanded ? (
            <ChevronDown className={cn("size-3.5 shrink-0", isQueueFolder ? "text-primary" : "text-muted-foreground")} />
          ) : (
            <ChevronRight className={cn("size-3.5 shrink-0", isQueueFolder ? "text-primary" : "text-muted-foreground")} />
          )}
        </span>
        {isQueueFolder ? (
          <Music className="size-3.5 shrink-0 text-primary" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
        {isQueueFolder && hasChildren && (
          <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
        )}
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
    <ScrollArea className="h-full">
      <div className="py-2">
        <TreeNode node={tree} depth={0} />
      </div>
    </ScrollArea>
  );
}
