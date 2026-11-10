/**
 * UI state for the app shell, login, admin area, budget and shared components.
 * Backend data lives in TanStack Query (`$lib/query/shell.ts`).
 */
import { browser } from '$app/environment';
import { createStore } from 'zustand/vanilla';
import type { SortingState, Updater } from '@tanstack/table-core';
import { getCachedNavFlags } from '$lib/auth';
import type { BudgetEntry, BudgetKind, Instrument, PaymentMethod, UserRole } from '$lib/types';

// ─── Nav bar (flags seeded from cache so first paint has the right icon count) ──

interface NavState {
  isAdmin: boolean;
  canAccessRehearsals: boolean;
  loggedIn: boolean;
  setFlags: (flags: { isAdmin: boolean; canAccessRehearsals: boolean; loggedIn: boolean }) => void;
}

const cachedNavFlags = getCachedNavFlags();
export const navStore = createStore<NavState>(set => ({
  isAdmin: cachedNavFlags.isAdmin,
  canAccessRehearsals: cachedNavFlags.canAccessRehearsals,
  loggedIn: cachedNavFlags.loggedIn,
  setFlags: flags => set(flags),
}));

// ─── Presence indicator (nav dot) ───────────────────────────────────────────────

export type PresenceScope = 'backlog' | 'setlist';
export type PresenceState = 'off' | 'alone' | 'withOthers';

interface PresenceUi {
  indicator: { state: PresenceState; scope: PresenceScope };
  setIndicator: (indicator: { state: PresenceState; scope: PresenceScope }) => void;
}

export const presenceStore = createStore<PresenceUi>(set => ({
  indicator: { state: 'off', scope: 'setlist' },
  setIndicator: indicator => set({ indicator }),
}));

// ─── Login ──────────────────────────────────────────────────────────────────────

export type LoginStatus = 'idle' | 'loading' | 'pending' | 'rejected' | 'error';

interface LoginState {
  status: LoginStatus;
  setStatus: (status: LoginStatus) => void;
}

export const loginStore = createStore<LoginState>(set => ({
  status: 'idle',
  setStatus: status => set({ status }),
}));

// ─── Admin: people manager ──────────────────────────────────────────────────────

type EditorKind = 'standalone' | 'attach' | 'edit' | null;

interface PeopleState {
  saving: string | null;
  error: boolean;
  roleSelections: Record<string, UserRole>;
  approvalSelections: Record<string, string>;
  approvalNames: Record<string, string>;
  approvalInstruments: Record<string, Instrument[]>;
  editorKind: EditorKind;
  editorUserId: string | null;
  draftName: string;
  draftInstruments: Instrument[];
  draftMergeTargetId: string;
  dragId: string | null;
  dragOverId: string | null;
  canDrag: boolean;
  removeTarget: { id: string; linked: boolean } | null;
  setRemoveTarget: (target: { id: string; linked: boolean } | null) => void;
  setSaving: (id: string | null) => void;
  setError: (error: boolean) => void;
  setRole: (userId: string, role: UserRole) => void;
  clearRoles: () => void;
  setApprovalSelection: (userId: string, value: string) => void;
  setApprovalName: (userId: string, value: string) => void;
  toggleApprovalInstrument: (userId: string, instrument: Instrument) => void;
  startStandalone: () => void;
  startAttach: (userId: string) => void;
  startEdit: (userId: string, name: string, instruments: Instrument[]) => void;
  cancelEditor: () => void;
  setDraftName: (name: string) => void;
  toggleDraftInstrument: (instrument: Instrument) => void;
  setDraftMergeTarget: (id: string) => void;
  setDrag: (id: string | null) => void;
  setDragOver: (id: string | null) => void;
  resetDrag: () => void;
}

const toggled = (list: Instrument[], item: Instrument) => list.includes(item) ? list.filter(i => i !== item) : [...list, item];

export const peopleStore = createStore<PeopleState>(set => ({
  saving: null,
  error: false,
  roleSelections: {},
  approvalSelections: {},
  approvalNames: {},
  approvalInstruments: {},
  editorKind: null,
  editorUserId: null,
  draftName: '',
  draftInstruments: [],
  draftMergeTargetId: '',
  dragId: null,
  dragOverId: null,
  canDrag: browser && !('ontouchstart' in window),
  removeTarget: null,
  setRemoveTarget: removeTarget => set({ removeTarget }),
  setSaving: saving => set({ saving }),
  setError: error => set({ error }),
  setRole: (userId, role) => set(s => ({ roleSelections: { ...s.roleSelections, [userId]: role } })),
  clearRoles: () => set({ roleSelections: {} }),
  setApprovalSelection: (userId, value) => set(s => ({ approvalSelections: { ...s.approvalSelections, [userId]: value } })),
  setApprovalName: (userId, value) => set(s => ({ approvalNames: { ...s.approvalNames, [userId]: value } })),
  toggleApprovalInstrument: (userId, instrument) => set(s => ({
    approvalInstruments: { ...s.approvalInstruments, [userId]: toggled(s.approvalInstruments[userId] ?? [], instrument) },
  })),
  startStandalone: () => set({ editorKind: 'standalone', editorUserId: null, draftName: '', draftInstruments: [], draftMergeTargetId: '' }),
  startAttach: userId => set({ editorKind: 'attach', editorUserId: userId, draftName: '', draftInstruments: [], draftMergeTargetId: '' }),
  startEdit: (userId, name, instruments) => set({ editorKind: 'edit', editorUserId: userId, draftName: name, draftInstruments: [...instruments], draftMergeTargetId: '' }),
  cancelEditor: () => set({ editorKind: null, editorUserId: null }),
  setDraftName: draftName => set({ draftName }),
  toggleDraftInstrument: instrument => set(s => ({ draftInstruments: toggled(s.draftInstruments, instrument) })),
  setDraftMergeTarget: draftMergeTargetId => set({ draftMergeTargetId }),
  setDrag: dragId => set({ dragId }),
  setDragOver: dragOverId => set({ dragOverId }),
  resetDrag: () => set({ dragId: null, dragOverId: null }),
}));

// ─── Admin: online users panel ──────────────────────────────────────────────────

interface OnlineState {
  now: number;
  touch: () => void;
}

export const onlineStore = createStore<OnlineState>(set => ({
  now: Date.now(),
  touch: () => set({ now: Date.now() }),
}));

// ─── Admin: audit log paging ────────────────────────────────────────────────────

interface AuditState {
  pageSize: number;
  cursorStack: string[];
  setPageSize: (size: number) => void;
  next: (cursor: string) => void;
  prev: () => void;
}

export const auditStore = createStore<AuditState>(set => ({
  pageSize: 20,
  cursorStack: [],
  setPageSize: pageSize => set({ pageSize, cursorStack: [] }),
  next: cursor => set(s => ({ cursorStack: [...s.cursorStack, cursor] })),
  prev: () => set(s => ({ cursorStack: s.cursorStack.slice(0, -1) })),
}));

// ─── Budget page + entry modal ──────────────────────────────────────────────────

export interface BudgetDraft {
  amountInput: string;
  method: PaymentMethod;
  dateLocal: string;
  comment: string;
  setlistId: string;
  person: string;
  spentBy: string;
  creditor: string;
  paid: boolean;
  description: string;
  receiptKey: string;
  receiptFile: File | null;
  saving: boolean;
  error: 'invalidAmount' | 'requestFailed' | null;
}

interface BudgetState {
  modalKind: BudgetKind | null;
  /** Id of the entry being edited (the entry itself comes from the budget query). */
  editEntryId: string | null;
  sorting: SortingState;
  setSorting: (updater: Updater<SortingState>) => void;
  deleteTargetId: string | null;
  setDeleteTarget: (id: string | null) => void;
  reportText: string;
  copied: boolean;
  draft: BudgetDraft;
  openAdd: (kind: BudgetKind) => void;
  openEdit: (entry: Pick<BudgetEntry, "id" | "kind">) => void;
  closeModal: () => void;
  setReport: (text: string) => void;
  setCopied: (copied: boolean) => void;
  setDraft: (patch: Partial<BudgetDraft>) => void;
  resetDraft: (draft: BudgetDraft) => void;
}

const emptyDraft: BudgetDraft = {
  amountInput: '', method: 'cash', dateLocal: '', comment: '', setlistId: '', person: '', spentBy: '',
  creditor: '', paid: false, description: '', receiptKey: '', receiptFile: null, saving: false, error: null,
};

export const budgetStore = createStore<BudgetState>(set => ({
  modalKind: null,
  editEntryId: null,
  sorting: [{ id: 'date', desc: true }],
  setSorting: updater => set(s => ({ sorting: typeof updater === 'function' ? updater(s.sorting) : updater })),
  deleteTargetId: null,
  setDeleteTarget: deleteTargetId => set({ deleteTargetId }),
  reportText: '',
  copied: false,
  draft: emptyDraft,
  openAdd: kind => set({ editEntryId: null, modalKind: kind }),
  openEdit: entry => set({ editEntryId: entry.id, modalKind: entry.kind }),
  closeModal: () => set({ modalKind: null, editEntryId: null }),
  setReport: reportText => set({ reportText, copied: false }),
  setCopied: copied => set({ copied }),
  setDraft: patch => set(s => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: draft => set({ draft }),
}));

// ─── Note (per-instance UI state, keyed by the component's `$props.id()`) ──────

export interface NoteUi {
  expanded: boolean;
  editing: boolean;
  draft: string;
  saving: boolean;
  failed: boolean;
  overflow: boolean;
}

export const defaultNoteUi: NoteUi = { expanded: false, editing: false, draft: '', saving: false, failed: false, overflow: false };

interface NoteState {
  notes: Record<string, NoteUi>;
  mobile: boolean;
  patch: (id: string, patch: Partial<NoteUi>) => void;
  dispose: (id: string) => void;
}

export const noteStore = createStore<NoteState>(set => ({
  notes: {},
  mobile: false,
  patch: (id, patch) => set(s => ({ notes: { ...s.notes, [id]: { ...defaultNoteUi, ...s.notes[id], ...patch } } })),
  dispose: id => set(s => {
    const { [id]: _removed, ...notes } = s.notes;
    return { notes };
  }),
}));

if (browser) {
  const query = window.matchMedia('(max-width: 700px)');
  const update = () => noteStore.setState({ mobile: query.matches });
  update();
  query.addEventListener('change', update);
}

