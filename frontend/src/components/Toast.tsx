import { useToastStore } from "@/stores/toastStore";
import { X } from "lucide-react";

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 max-w-xs bg-red-700 text-white text-sm px-3 py-2 rounded-lg shadow-lg"
        >
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
