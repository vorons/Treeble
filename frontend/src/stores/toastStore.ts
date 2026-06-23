import { create } from "zustand";

let nextId = 1;

interface Toast {
  id: number;
  text: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (text: string) => void;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (text: string) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id: number) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
