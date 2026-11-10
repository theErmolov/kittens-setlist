/** Non-2xx API response; `status` lets callers (and the QueryClient) react to 401/403. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isAuthError = (err: unknown): err is ApiError =>
  err instanceof ApiError && (err.status === 401 || err.status === 403);
