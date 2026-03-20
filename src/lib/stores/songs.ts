import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Song } from '$lib/types';
import mockSongs from '$lib/data/mock-songs.json';

const STORAGE_KEY = 'kittens_songs';
const DATA_VERSION = '4'; // bump to reset stale localStorage

function loadSongs(): Song[] {
  if (!browser) return mockSongs as Song[];
  if (localStorage.getItem('kittens_data_version') !== DATA_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('kittens_data_version', DATA_VERSION);
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Song[];
    } catch {
      return mockSongs as Song[];
    }
  }
  return mockSongs as Song[];
}

function createSongsStore() {
  const { subscribe, set, update } = writable<Song[]>(loadSongs());

  function persist(songs: Song[]) {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    }
    return songs;
  }

  return {
    subscribe,
    addSong(song: Song) {
      update(songs => persist([...songs, song]));
    },
    updateSong(updated: Song) {
      update(songs => persist(songs.map(s => s.id === updated.id ? updated : s)));
    },
    deleteSong(id: string) {
      update(songs => persist(songs.filter(s => s.id !== id)));
    },
    reset() {
      set(persist(mockSongs as Song[]));
    }
  };
}

export const songsStore = createSongsStore();
