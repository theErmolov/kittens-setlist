export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin' | 'maracas' | 'vocals';

export interface MusicianRole {
  instruments: Instrument[];  // empty = present but "free" (no specific instrument)
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstrument?: Instrument;  // their usual instrument, pre-selected in song edit
  sortOrder?: number;
  guest?: boolean;  // true = guest musician; not shown as table columns
}

export interface Song {
  id: string;
  artist: string;
  title: string;
  category: Category;
  comment?: string;  // general note, copied to setlist entry on add
  musicians: Record<string, MusicianRole>;
  sortOrder?: number;
}

export interface SetlistEntry {
  songId?: string;        // absent for breaks
  song?: Song;            // embedded snapshot (present for all song entries)
  breakMinutes?: number;  // present for breaks
  order: number;
  played: boolean;
  comment?: string;       // per-setlist note on this song
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  startTime?: string;  // HH:MM, 24h
  entries: SetlistEntry[];
}
