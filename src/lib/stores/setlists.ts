import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Setlist, SetlistEntry } from '$lib/types';

const STORAGE_KEY = 'kittens_setlists';

function loadSetlists(): Setlist[] {
  if (!browser) return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Setlist[];
    } catch {
      return [];
    }
  }
  return [];
}

function createSetlistsStore() {
  const { subscribe, update } = writable<Setlist[]>(loadSetlists());

  function persist(setlists: Setlist[]) {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(setlists));
    }
    return setlists;
  }

  return {
    subscribe,
    addSetlist(setlist: Setlist) {
      update(lists => persist([...lists, setlist]));
    },
    updateSetlist(updated: Setlist) {
      update(lists => persist(lists.map(l => l.id === updated.id ? updated : l)));
    },
    deleteSetlist(id: string) {
      update(lists => persist(lists.filter(l => l.id !== id)));
    },
    togglePlayed(setlistId: string, songId: string) {
      update(lists => persist(lists.map(l => {
        if (l.id !== setlistId) return l;
        return {
          ...l,
          entries: l.entries.map(e =>
            e.songId === songId ? { ...e, played: !e.played } : e
          )
        };
      })));
    },
    reorderEntries(setlistId: string, entries: SetlistEntry[]) {
      update(lists => persist(lists.map(l =>
        l.id === setlistId ? { ...l, entries } : l
      )));
    }
  };
}

export const setlistsStore = createSetlistsStore();
