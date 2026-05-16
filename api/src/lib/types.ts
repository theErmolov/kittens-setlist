// Mirrors src/lib/types.ts — keep in sync

export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'cajon' | 'violin' | 'percussion' | 'vocals';
export type LearningStage = 'nothing' | 'queue' | 'structure' | 'mastering' | 'ready';

export interface MusicianRole {
  instruments: Instrument[];  // empty = free
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstruments?: Instrument[];
  sortOrder?: number;
  guest?: boolean;
}

export interface Song {
  id: string;
  artist: string;
  title: string;
  category: Category;
  comment?: string;  // general note, copied to setlist entry on add
  musicians: Record<string, MusicianRole>;
  sortOrder?: number;
  progress?: Record<string, LearningStage>;
  lyrics?: string;
  transpose?: number;
}

export interface SetlistEntry {
  songId?: string;
  song?: Song;
  breakMinutes?: number;
  order: number;
  played: boolean;
  playedAt?: string;  // ISO 8601, set when marked played
  comment?: string;
  progress?: Record<string, LearningStage>;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  startTime?: string;
  vibe?: boolean;
  entries: SetlistEntry[];
}

export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'writer' | 'reader';

export interface KittensUser {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  status: UserStatus;
  role?: UserRole;
  musicianId?: string;
  isAdmin?: boolean;
  createdAt: string;
  approvedAt?: string;
}

export interface KittensSession {
  token: string;
  telegramId: string;
  expiresAt: number;  // Unix seconds
}
