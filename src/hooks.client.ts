// DEV ONLY: `VITE_DEV_MOCK=1` in `.env` replaces the backend with in-browser mock data (see src/lib/dev/mockApi.ts).
// The condition is a build-time constant, so production builds drop the import entirely.
if (import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK === '1') await import('$lib/dev/mockApi');
