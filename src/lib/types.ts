export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin';

export interface MusicianRole {
  instrument?: Instrument;  // undefined = present but "free" (no specific instrument)
  vocals: boolean;
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstrument?: Instrument;  // their usual instrument, pre-selected in song edit
  sortOrder?: number;
}

export interface Song {
  id: string;
  artist: string;
  title: string;
  category: Category;
  comment?: string;
  musicians: Record<string, MusicianRole>;
  extraMusicians?: string;
  sortOrder?: number;
}

export interface SetlistEntry {
  songId?: string;        // absent for breaks
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
