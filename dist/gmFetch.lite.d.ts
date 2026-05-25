/**
 * Lightweight `fetch()` replacement backed by `GM_xmlhttpRequest`.
 *
 * Compared to the full version, this drops:
 * - SRI integrity verification
 * - Cache mode mapping (always default HTTP caching)
 * - ReadableStream response (always blob)
 * - GM-specific options passthrough (cookie, proxy, timeout, etc.)
 *
 * What you keep:
 * - Full Request normalisation (method, url, body, headers via Request constructor)
 * - Forbidden headers preservation (Cookie, User-Agent, Referer, Origin, Host)
 * - AbortSignal support (AbortController + AbortSignal.timeout())
 * - Correct Response with url, type, redirected, status, headers
 * - credentials → anonymous mapping
 * - Proper error semantics (TypeError for network, DOMException for abort/timeout)
 */
export interface GmFetchLiteInit extends RequestInit {
}
declare function gmFetchLite(input: RequestInfo | URL, init?: GmFetchLiteInit): Promise<Response>;
export default gmFetchLite;
