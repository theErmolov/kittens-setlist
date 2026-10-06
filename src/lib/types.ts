export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'cajon' | 'violin' | 'saxophone' | 'trumpet' | 'percussion' | 'vocals';
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
  transpose?: number;
  archived?: boolean;  // moved out of active backlog; setlist snapshots are unaffected
}

export interface SetlistEntry {
  songId?: string;        // absent for breaks
  song?: Song;            // embedded snapshot (present for all song entries)
  breakMinutes?: number;  // present for breaks
  order: number;
  played: boolean;
  playedAt?: string;      // ISO 8601, set when marked played
  comment?: string;       // per-setlist note on this song
  progress?: Record<string, LearningStage>;  // per-entry progress (all musicians incl. guests)
  subsetId?: string;      // groups a song into a contiguous subset block
  setlistOnly?: boolean;  // created directly in this setlist (no backlog record)
}

export interface SetlistSubset {
  id: string;
  name: string;
  order?: number;         // header position in the same visual sequence as entry.order
  manualSort?: boolean;  // true once user drag-sorts inside → auto-sort disabled
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  startTime?: string;  // HH:MM, 24h
  vibe?: boolean;
  entries: SetlistEntry[];
  subsets?: SetlistSubset[];
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

// ─── Budget ───────────────────────────────────────────────────────────────────
// Mirrors api/src/lib/types.ts — keep in sync.

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
// Mirrors api/src/lib/types.ts — keep in sync.

export interface PresenceEntry {
  room: string;           // shared resource id: 'backlog' or `setlist:<id>`
  clientId: string;       // per-tab id (sessionStorage on the client)
  userId?: string;        // resolved user id, if authenticated
  name: string;           // display name; 'гость' for anonymous
  canMark: boolean;       // true for admins/writers — only they can mutate
  lastSeen: string;       // ISO 8601
  expiresAt: number;      // Unix seconds
}
