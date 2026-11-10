/**
 * Presence: lightweight heartbeats so a collaborative view polls only when
 * another user who can mutate the shared resource is also viewing it.
 *
 * Each open view (backlog, setlist editor, stage) creates a PresenceController
 * that heartbeats every 20s. The heartbeat response lists the *other* live
 * viewers; if none can change shared data or the current author’s private notes,
 * the data poller is paused.
 * Heartbeat failures fall back to polling (graceful degradation against an old
 * backend).
 *
 * The nav bar reads `presenceIndicator` to show a dot on the active section's
 * icon: green when someone else is here, yellow when you're alone.
 */
import { currentUser } from '$lib/auth';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { leavePresence } from '$lib/api';
import { isAuthError } from '$lib/apiError';
import { queryClient } from '$lib/query/client';
import { presenceHeartbeatQuery } from '$lib/query/shell';
import { presenceStore, type PresenceScope, type PresenceState } from '$lib/store/shell';
import { useStore } from '$lib/store/bridge';
import type { PresenceEntry } from '$lib/types';

const CLIENT_ID_KEY = 'kittens_presence_client_id';
const HEARTBEAT_MS = 20_000;

/** Which nav icon the indicator dot belongs to. */
export type { PresenceScope, PresenceState };

/** Room strings are the DynamoDB partition key: the shared resource being viewed. */
export const BACKLOG_ROOM = 'backlog';
export function setlistRoom(id: string): string { return `setlist:${id}`; }

/** Per-tab client id. sessionStorage is scoped to a single tab (survives reload,
 * not shared with other tabs), so two tabs of the same user are distinct clients
 * that can mutate — each must see the other and keep polling. */
export function getPresenceClientId(): string {
  if (!browser) return '';
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

/** Current presence state for the nav dot: 'off' (no active view / heartbeat
 * failed), 'alone' (only you here), 'withOthers' (someone else is here). */
export const presenceIndicator = useStore(presenceStore, s => s.indicator);

export class PresenceController {
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private room: string, private scope: PresenceScope) {}

  /** The heartbeat result lives in the query cache; `lastOk` is true while the latest heartbeat succeeded. */
  private get key() { return presenceHeartbeatQuery(this.room, getPresenceClientId()).queryKey; }
  private get others(): PresenceEntry[] { return queryClient.getQueryData<{ others: PresenceEntry[] }>(this.key)?.others ?? []; }
  private get lastOk(): boolean { return queryClient.getQueryState(this.key)?.status === 'success'; }

  private get hasOtherMutators(): boolean {
    const user = get(currentUser);
    return this.others.some(o => o.canMark || (user?.status === 'approved' && o.userId === user.id));
  }

  /** The data poller should be suppressed only once we've *successfully*
   * confirmed no other mutator is present. A failed heartbeat returns false
   * (don't suppress) so we keep polling as before. */
  isPaused(): boolean {
    return this.lastOk && !this.hasOtherMutators;
  }

  start(): void {
    if (!browser) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  private onVisibilityChange = (): void => {
    if (!document.hidden) this.tick(); // re-sync immediately on return
  };

  private onPageHide = (): void => {
    leavePresence(this.room, getPresenceClientId());
  };

  private async tick(): Promise<void> {
    if (this.stopped || document.hidden) return;
    try {
      await queryClient.fetchQuery(presenceHeartbeatQuery(this.room, getPresenceClientId()));
    } catch (err) {
      // Old backend (no route) or network blip — don't suppress polling (the query is now in error state, so `lastOk` is false).
      // 401/403: the token can't use presence — stop heartbeating instead of retrying forever.
      if (isAuthError(err) && this.timer) { clearInterval(this.timer); this.timer = null; }
    }
    presenceStore.getState().setIndicator({
      scope: this.scope,
      state: this.lastOk ? (this.others.length > 0 ? 'withOthers' : 'alone') : 'off',
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    leavePresence(this.room, getPresenceClientId());
    presenceStore.getState().setIndicator({ state: 'off', scope: this.scope });
    queryClient.removeQueries({ queryKey: this.key });
  }
}
