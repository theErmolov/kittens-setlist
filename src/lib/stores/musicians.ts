import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { BandMusician } from '$lib/types';

const STORAGE_KEY = 'kittens_musicians';
const MUSICIANS_VERSION = '2'; // bump when BandMusician shape changes

const defaults: BandMusician[] = [
  { id: '1', name: 'Илья',   defaultInstrument: 'guitar' },
  { id: '2', name: 'Андрей', defaultInstrument: 'drums' },
  { id: '3', name: "iL'Ja",  defaultInstrument: 'guitar' },
  { id: '4', name: 'Тоня',   defaultInstrument: 'bass' },
  { id: '5', name: 'Маша',   defaultInstrument: 'violin' },
];

function load(): BandMusician[] {
  if (!browser) return defaults;
  if (localStorage.getItem('kittens_musicians_version') !== MUSICIANS_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('kittens_musicians_version', MUSICIANS_VERSION);
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return defaults; }
  }
  return defaults;
}

function createStore() {
  const { subscribe, update } = writable<BandMusician[]>(load());

  function persist(list: BandMusician[]) {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  }

  return {
    subscribe,
    add(m: BandMusician) {
      update(list => persist([...list, m]));
    },
    update(m: BandMusician) {
      update(list => persist(list.map(x => x.id === m.id ? m : x)));
    },
    remove(id: string) {
      update(list => persist(list.filter(x => x.id !== id)));
    },
  };
}

export const musiciansStore = createStore();
