import { createStore } from 'zustand/vanilla';

interface DragModeState {
  enabled: boolean;
  toggle: () => void;
}

/** Whether drag-and-drop reordering is switched on (rehearsal songs, setlist entries). Off by default, not persisted. */
export const dragModeStore = createStore<DragModeState>(set => ({
  enabled: false,
  toggle: () => set(s => ({ enabled: !s.enabled })),
}));
