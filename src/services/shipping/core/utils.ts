/**
 * HTTP helpers with timeout and retries for provider calls
 */

// Configuration constants from environment variables
export const DEFAULT_TIMEOUT_MS = Number(process.env.SHIPPING_HTTP_TIMEOUT_MS || 10000);
export const DEFAULT_MAX_RETRIES = Number(process.env.SHIPPING_HTTP_MAX_RETRIES || 2);
export const DEFAULT_BACKOFF_MS = Number(process.env.SHIPPING_HTTP_BACKOFF_MS || 500);

/**
 * Sleep helper for delayed retries
 * @param ms Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and exponential backoff
 * @param url URL to fetch
 * @param init Fetch init options
 * @param opts Optional configuration for timeout and retries
 * @returns Response object
 */
export async function fetchWithRetry(
    url: string,
    init: any = {},
    opts?: { timeoutMs?: number; retries?: number; backoffMs?: number }
): Promise<Response> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = opts?.retries ?? DEFAULT_MAX_RETRIES;
    const backoffMs = opts?.backoffMs ?? DEFAULT_BACKOFF_MS;

    let attempt = 0;
    while (true) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...init, signal: ctrl.signal });
            clearTimeout(id);
            if (res.ok) return res;
            // Retry on 5xx, 429, 408
            if (attempt < maxRetries && (res.status >= 500 || res.status === 429 || res.status === 408)) {
                attempt++;
                const jitter = Math.floor(Math.random() * 100);
                await sleep(backoffMs * Math.pow(2, attempt - 1) + jitter);
                continue;
            }
            return res; // caller will handle not ok
        } catch (err: any) {
            clearTimeout(id);
            const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
            if (attempt < maxRetries && (isAbort || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT')) {
                attempt++;
                const jitter = Math.floor(Math.random() * 100);
                await sleep(backoffMs * Math.pow(2, attempt - 1) + jitter);
                continue;
            }
            throw err;
        }
    }
}
