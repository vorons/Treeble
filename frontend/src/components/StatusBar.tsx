import { usePlayerStore } from "@/stores/playerStore";
import { t } from "@/lib/i18n";
import { Folder, Repeat, Repeat1, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectFolder as ipcSelectFolder, setMusicFolder as ipcSetMusicFolder } from "@/lib/ipc";

export default function StatusBar() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentQueueFolder = usePlayerStore((s) => s.currentQueueFolder);
  const currentFolder = usePlayerStore((s) => s.currentFolder);
  const playing = usePlayerStore((s) => s.playing);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const musicRoot = usePlayerStore((s) => s.musicRoot);
  const defaultMusicRoot = usePlayerStore((s) => s.defaultMusicRoot);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const ctxFolder = currentQueueFolder ?? currentFolder;
  const isDefaultFolder = !musicRoot || !defaultMusicRoot || musicRoot === defaultMusicRoot;
  const count = queue.length;
  const folderName = ctxFolder
    ? ctxFolder.split("/").filter(Boolean).pop()
    : null;

  const repeatActive = repeatMode !== "off";

  const handleFolderClick = async () => {
    const path = await ipcSelectFolder();
    if (!path) return;
    const newTree = await ipcSetMusicFolder(path);
    usePlayerStore.setState({ tree: newTree, currentFolder: path, folderTracks: [], musicRoot: path });
    // Load tracks for the selected folder
    const { selectFolder } = usePlayerStore.getState();
    await selectFolder(path);
  };

  return (
    <div className="flex items-center justify-between border-t border-border bg-black/20 px-4 py-1 text-xs text-muted-foreground shrink-0">
      {/* Left: folder picker button + folder/track info */}
      <span className="truncate flex items-center gap-1.5 min-w-0">
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleFolderClick} title={t("selectMusicFolder")}>
          <Folder className={`size-3.5 ${isDefaultFolder ? "text-muted-foreground" : "text-primary"}`} />
        </Button>
        {folderName && count > 0 ? (
          <span className="truncate">
            <span className="font-medium">{folderName}</span>
            <span className="mx-1.5 text-muted-foreground">—</span>
            <span className="tabular-nums">{currentIndex + 1}/{count}</span>
          </span>
        ) : folderName ? (
          <span className="truncate">{folderName}</span>
        ) : playing ? (
          <span className="truncate">{t("playing")}</span>
        ) : (
          <span className="truncate">{t("noFolderSelected")}</span>
        )}
      </span>

      {/* Right: repeat + shuffle */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Repeat icon — 3-state cycle */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 ${repeatActive ? "text-primary" : ""}`}
          onClick={cycleRepeat}
          title={
            repeatMode === "off"
              ? t("repeatOff")
              : repeatMode === "one"
                ? t("repeatOne")
                : t("repeatFolder")
          }
        >
          {repeatMode === "one" ? <Repeat1 className="size-3.5" /> : <Repeat className="size-3.5" />}
        </Button>

        {/* Shuffle icon — toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 ${shuffle ? "text-primary" : ""}`}
          onClick={toggleShuffle}
          title={shuffle ? t("shuffleOn") : t("shuffleOff")}
        >
          <Shuffle className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
