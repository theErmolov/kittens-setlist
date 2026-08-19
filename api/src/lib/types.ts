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
  lengthMinutes?: number;
  progress?: Record<string, LearningStage>;
  lyrics?: string;
  transpose?: number;
  archived?: boolean;
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
  clientId: string;       // per-tab id (sessionStorage on the client)
  userId?: string;        // resolved user id, if authenticated
  name: string;           // display name; 'гость' for anonymous
  canMark: boolean;       // true for admins/writers — only they can mutate
  lastSeen: string;       // ISO 8601, set on each heartbeat
  expiresAt: number;      // Unix seconds — DynamoDB TTL
}
