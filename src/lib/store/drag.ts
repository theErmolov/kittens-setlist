import { createStore } from 'zustand/vanilla';
import { browser } from '$app/environment';
import { below } from '$lib/breakpoints';

type Tier = 'small' | 'mid' | 'big';

interface DragModeState {
  /** Whether drag-and-drop reordering is on at the CURRENT screen size (what the views read). */
  enabled: boolean;
  /** The current screen-size tier, kept in sync with the viewport. */
  tier: Tier;
  /** The switch, remembered separately for every screen size. */
  byTier: Record<Tier, boolean>;
  toggle: () => void;
  setTier: (tier: Tier) => void;
}

const currentTier = (): Tier => (!browser ? 'big' : below('mid').matches ? 'small' : below('big').matches ? 'mid' : 'big');

/**
 * Whether drag-and-drop reordering is switched on (rehearsal songs, setlist entries). Each screen size has its own switch:
 * on by default on big screens only, off on mid and small ones. Not persisted across reloads.
 */
export const dragModeStore = createStore<DragModeState>((set, get) => ({
  enabled: currentTier() === 'big',
  tier: currentTier(),
  byTier: { small: false, mid: false, big: true },
  toggle: () => set(s => {
    const byTier = { ...s.byTier, [s.tier]: !s.byTier[s.tier] };
    return { byTier, enabled: byTier[s.tier] };
  }),
  setTier: tier => { if (tier !== get().tier) set(s => ({ tier, enabled: s.byTier[tier] })); },
}));

if (browser) {
  const sync = () => dragModeStore.getState().setTier(currentTier());
  below('mid').addEventListener('change', sync);
  below('big').addEventListener('change', sync);
  sync();
}
