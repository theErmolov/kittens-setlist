export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'cajon' | 'violin' | 'percussion' | 'vocals';
export type LearningStage = 'queue' | 'structure' | 'mastering' | 'ready';

export interface MusicianRole {
  instruments: Instrument[];  // empty = present but "free" (no specific instrument)
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstruments?: Instrument[];  // pre-selected when adding a song
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
  lengthMinutes?: number;
  progress?: Record<string, LearningStage>;  // keyed by musician name
  lyrics?: string;
}

export interface SetlistEntry {
  songId?: string;        // absent for breaks
  song?: Song;            // embedded snapshot (present for all song entries)
  breakMinutes?: number;  // present for breaks
  order: number;
  played: boolean;
  comment?: string;       // per-setlist note on this song
  progress?: Record<string, LearningStage>;  // per-entry progress (all musicians incl. guests)
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  startTime?: string;  // HH:MM, 24h
  entries: SetlistEntry[];
}

export interface AuditLogEntry {
  sk: string;
  timestamp: string;
  action: string;
  actorTelegramId: string;
  actorName: string;
  entityType: 'song' | 'setlist' | 'musician' | 'setlist_entry' | 'user';
  entityId: string;
  entityName: string;
  summary: string;
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
