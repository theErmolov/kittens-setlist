import { createStore } from 'zustand/vanilla';

/** Optional header customisation: default is the 🤫 "Only me" personal note. */
export interface NotePopoverMeta {
  icon?: string;
  title?: string;
  /** Adds an edit IconButton in the popover (e.g. setlist comment → open the editor). */
  onedit?: () => void;
  editLabel?: string;
}

export interface NotePopoverState {
  /** `anchor` is the clicked button; the popover positions itself against it. */
  open: ({ key: string; text: string; anchor: HTMLElement } & NotePopoverMeta) | null;
  /** Opens the note viewer under `anchor`, or closes it if the same key is already open. */
  toggle: (key: string, text: string, anchor: HTMLElement, meta?: NotePopoverMeta) => void;
  close: () => void;
}

/** Shared viewer state for notes shown in a popover: 🤫 personal notes on song rows, the setlist comment (💬). */
export const notePopoverStore = createStore<NotePopoverState>((set, get) => ({
  open: null,
  toggle: (key, text, anchor, meta = {}) => {
    if (get().open?.key === key) return set({ open: null });
    set({ open: { key, text, anchor, ...meta } });
  },
  close: () => set({ open: null }),
}));
