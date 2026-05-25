// GM_xmlhttpRequest and GM are provided by the userscript engine at runtime.
// Types declared in gm-types.d.ts (ambient).

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

export interface GmFetchLiteInit extends RequestInit {}

// Alias globals — terser mangles local names but not global property access.
const TypeErr = TypeError, DOMEx = DOMException;
const fromEntries = Object.fromEntries;
const defProp = Object.defineProperty;
const FETCH_ERR = "Failed to fetch", ABORT_EVT = "abort";
const RE_FOLD = /\r?\n[\t ]+/g, RE_NEWLINE = /\r?\n/;

/** Stamp read-only Response properties that the constructor doesn't allow setting. */
function stamp(response: Response, url: string, finalUrl: string, headers: Headers): Response {
  defProp(response, "url", { value: finalUrl, configurable: true });
  defProp(response, "type", { value: "basic", configurable: true });
  if (url !== finalUrl) defProp(response, "redirected", { value: true, configurable: true });
  if (headers.has("set-cookie")) defProp(response, "headers", { value: headers, configurable: true });
  return response;
}

function parseHeaders(raw: string): Headers {
  const headers = new Headers();
  if (!raw) return headers;
  for (const line of raw.replace(RE_FOLD, " ").split(RE_NEWLINE)) {
    const colon = line.indexOf(":");
    if (colon > 0) try { headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim()); } catch {}
  }
  return headers;
}

async function gmFetchLite(input: RequestInfo | URL, init?: GmFetchLiteInit): Promise<Response> {
  const gmXhr = (typeof GM_xmlhttpRequest === "function" && GM_xmlhttpRequest)
    || (typeof GM === "object" && GM?.xmlHttpRequest);
  if (typeof gmXhr !== "function")
    throw new DOMEx("GM_xmlhttpRequest not granted.", "NotFoundError");

  const request = new Request(input, init);
  const { signal, method, url, credentials, redirect } = request;
  const makeAbortError = (): Error =>
    signal.reason instanceof Error ? signal.reason : new DOMEx("Aborted", "AbortError");

  if (signal.aborted) throw makeAbortError();

  const requestBody = request.body ? await request.blob() : undefined;
  if (requestBody && signal.aborted) throw makeAbortError();

  const headers: Record<string, string> = fromEntries(request.headers as any);
  const rawHeaders = init?.headers as any;
  if (rawHeaders && !(rawHeaders instanceof Headers)) {
    if (typeof rawHeaders[Symbol.iterator] === "function")
      for (const [k, v] of rawHeaders) headers[(k as string).toLowerCase()] = v;
    else
      for (const k of Object.keys(rawHeaders)) headers[k.toLowerCase()] = rawHeaders[k];
  }

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    let abortGm: (() => void) | undefined;

    const fail = (error: unknown, cancelRequest = false): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener(ABORT_EVT, onSignalAbort);
      reject(error);
      if (cancelRequest) abortGm?.();
    };
    const onSignalAbort = (): void => fail(makeAbortError(), true);
    signal.addEventListener(ABORT_EVT, onSignalAbort);

    try {
      ({ abort: abortGm } = gmXhr({
        method, url, headers, redirect,
        data: requestBody?.size ? requestBody : undefined,
        binary: true,
        anonymous: credentials === "omit",
        responseType: "blob" as any,

        onload(ev: any) {
          if (settled) return;
          settled = true;
          signal.removeEventListener(ABORT_EVT, onSignalAbort);
          const { responseHeaders, status, statusText, finalUrl, response: body } = ev;
          if (!status) { reject(new TypeErr(FETCH_ERR)); return; }

          const h = parseHeaders(responseHeaders);
          resolve(stamp(new Response(body as Blob, { headers: h, status, statusText }), url, finalUrl, h));
        },

        onerror({ statusText: st, error: err }: any) { fail(new TypeErr(st || err || FETCH_ERR)); },
        ontimeout() { fail(new DOMEx("Timed out", "TimeoutError")); },
        onabort() { fail(makeAbortError()); },
      }));
    } catch (e) {
      fail(e instanceof Error ? e : new TypeErr(String(e)));
    }
  });
}

export default gmFetchLite;
