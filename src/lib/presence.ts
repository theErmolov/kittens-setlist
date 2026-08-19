/**
 * Presence: lightweight heartbeats so a setlist view polls only when another
 * user who can mutate the setlist is also viewing it.
 *
 * Each open setlist view (editor or stage) creates a PresenceController that
 * heartbeats every 20s. The heartbeat response lists the *other* live viewers;
 * if none of them can mutate (canMark), the data poller is paused. Heartbeat
 * failures fall back to polling (graceful degradation against an old backend).
 */
import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';
import { heartbeatPresence, leavePresence } from '$lib/api';
import type { PresenceEntry } from '$lib/types';

const CLIENT_ID_KEY = 'kittens_presence_client_id';
const HEARTBEAT_MS = 20_000;

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

/** True while a setlist view is actively syncing because another mutator is
 * present. The layout renders the green nav dot off this store. */
export const presencePollingActive: Writable<boolean> = writable(false);

export class PresenceController {
  private others: PresenceEntry[] = [];
  private lastOk = false;
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private setlistId: string) {}

  private get hasOtherMutators(): boolean {
    return this.others.some(o => o.canMark);
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
    leavePresence(this.setlistId, getPresenceClientId());
  };

  private async tick(): Promise<void> {
    if (this.stopped || document.hidden) return;
    try {
      const { others } = await heartbeatPresence(this.setlistId, getPresenceClientId());
      this.others = others;
      this.lastOk = true;
    } catch {
      // Old backend (no route) or network blip — don't suppress polling.
      this.lastOk = false;
    }
    presencePollingActive.set(this.lastOk && this.hasOtherMutators);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    leavePresence(this.setlistId, getPresenceClientId());
    presencePollingActive.set(false);
    this.others = [];
  }
}
