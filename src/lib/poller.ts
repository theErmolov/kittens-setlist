/**
 * Starts polling `fn` every `intervalMs` ms.
 * Skips ticks when the tab is hidden or `isPaused()` returns true.
 * Polls immediately when the tab becomes visible again.
 * Returns a cleanup function (call it from onMount's return / onDestroy).
 */
export function startPolling(
  fn: () => Promise<void>,
  intervalMs: number,
  isPaused: () => boolean,
): () => void {
  const tick = () => { if (!document.hidden && !isPaused()) fn().catch(() => {}); };
  const onVisible = () => { if (!document.hidden && !isPaused()) fn().catch(() => {}); };

  const timer = setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
