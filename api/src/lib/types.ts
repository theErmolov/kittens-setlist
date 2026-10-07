// Mirrors src/lib/types.ts — keep in sync

export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'cajon' | 'violin' | 'saxophone' | 'trumpet' | 'percussion' | 'vocals';
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
  personalComment?: string; // response-only: current author’s private note
  comment?: string;  // general note, copied to setlist entry on add
  musicians: Record<string, MusicianRole>;
  sortOrder?: number;
  lengthMinutes?: number;
  progress?: Record<string, LearningStage>;
  lyrics?: string;
  transpose?: number;
  archived?: boolean;
}

export interface SetlistEntry {
  personalComment?: string; // response-only, stored separately from shared entries
  songId?: string;
  song?: Song;
  breakMinutes?: number;
  order: number;
  played: boolean;
  playedAt?: string;  // ISO 8601, set when marked played
  comment?: string;
  progress?: Record<string, LearningStage>;
  subsetId?: string;  // groups a song into a contiguous subset block
  setlistOnly?: boolean;  // created directly in this setlist (no backlog record)
}

export interface SetlistSubset {
  id: string;
  name: string;
  order?: number;  // header position in the same visual sequence as entry.order
  manualSort?: boolean;  // true once user drag-sorts inside → auto-sort disabled
}

export interface Setlist {
  comment?: string;
  id: string;
  name: string;
  date?: string;
  startTime?: string;
  vibe?: boolean;
  entries: SetlistEntry[];
  subsets?: SetlistSubset[];
}

export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'writer' | 'reader';

export interface User {
  id: string;
  telegramId?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  status?: UserStatus;
  role?: UserRole;
  isAdmin?: boolean;
  createdAt?: string;
  approvedAt?: string;
  musicianName?: string;
  defaultInstruments?: Instrument[];
  sortOrder?: number;
  guest?: boolean;
}

export interface KittensSession {
  token: string;
  telegramId: string;
  expiresAt: number;  // Unix seconds
}

// ─── Budget ───────────────────────────────────────────────────────────────────
// Mirrors src/lib/types.ts — keep in sync.

export type BudgetKind = 'income' | 'expense' | 'debt';
export type PaymentMethod = 'cash' | 'transfer';

export interface BudgetBase {
  id: string;
  kind: BudgetKind;
  amount: number;      // EUR cents, integer
  date: string;        // ISO 8601 datetime
  comment?: string;
  setlistId?: string;  // assigned event (optional)
  createdAt: string;   // ISO 8601, server-set
  createdBy: string;   // actor telegramId, server-set
}

export interface IncomeEntry extends BudgetBase {
  kind: 'income';
  method: PaymentMethod;
  person?: string;     // who donated
}

export interface ExpenseEntry extends BudgetBase {
  kind: 'expense';
  method: PaymentMethod;
  spentBy?: string;    // who made the expense
  description?: string;
  receiptKey?: string; // S3 object key
}

export interface DebtEntry extends BudgetBase {
  kind: 'debt';
  creditor?: string;   // to whom we owe (e.g. "город")
  description?: string;
  paid?: boolean;
  paidAt?: string;     // ISO 8601, set when marked paid
}

export type BudgetEntry = IncomeEntry | ExpenseEntry | DebtEntry;

// ─── Presence ─────────────────────────────────────────────────────────────────
// Mirrors src/lib/types.ts — keep in sync.

export interface PresenceEntry {
  room: string;           // shared resource id: 'backlog' or `setlist:<id>`
  clientId: string;       // per-tab id (sessionStorage on the client)
  userId?: string;        // resolved user id, if authenticated
  name: string;           // display name; 'гость' for anonymous
  canMark: boolean;       // true for admins/writers — only they can mutate
  lastSeen: string;       // ISO 8601, set on each heartbeat
  expiresAt: number;      // Unix seconds — DynamoDB TTL
}

// Rehearsals have an independent song selection; learning progress stays live.
export interface RehearsalSong {
  songId: string;
  sourceSetlistId?: string;
  song: Song; // arrangement snapshot; API overlays current learning progress
  note?: string;
  sourceMissing?: boolean; // response-only: original song/entry was removed
}

export interface Rehearsal {
  id: string;
  date: string; // YYYY-MM-DD, in timeZone
  startTime: string;
  endTime?: string; // same day
  timeZone: string;
  location?: string;
  note?: string;
  setlistId?: string;
  attendees: string[]; // includes named guests without registered accounts
  songs: RehearsalSong[];
  cancelled: boolean;
  version: number;
  createdAt: string;
  createdBy: string;
}
export type RehearsalDraft = Pick<Rehearsal, 'date' | 'startTime' | 'endTime' | 'timeZone' | 'location' | 'note' | 'setlistId' | 'attendees' | 'songs' | 'cancelled'>;
