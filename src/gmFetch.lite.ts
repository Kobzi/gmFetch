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

/** Network failure → spec-generic TypeError, with raw GM event on `.cause` for debugging. */
const netErr = (cause: unknown): TypeError => new TypeErr(FETCH_ERR, { cause });

/** Stamp read-only Response properties that the constructor doesn't allow setting. */
function stamp(response: Response, url: string, finalUrl: string, headers: Headers): Response {
  const def = (key: string, value: unknown): void => { defProp(response, key, { value, configurable: true }); };
  def("url", finalUrl);
  def("type", "basic");
  if (url !== finalUrl) def("redirected", true);
  if (headers.has("set-cookie")) def("headers", headers);
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

/**
 * Decide how to hand the request body to GM_xmlhttpRequest.
 *
 * Text bodies (string, URLSearchParams) are forwarded as-is so the server gets
 * a normal text/JSON/form payload instead of a binary blob upload, which some
 * endpoints reject. Everything else (Blob, ArrayBuffer, typed arrays, FormData)
 * is buffered into a Blob and sent with `binary: true` to preserve bytes. The
 * Content-Type computed by the Request constructor is already in the headers.
 */
async function readBody(
  request: Request,
  raw: BodyInit | null | undefined,
): Promise<{ data: string | Blob | undefined; binary: boolean }> {
  // Text bodies: forward the original init.body directly. We must not gate this on
  // `request.body`, because some engines (Firefox userscript sandbox) expose
  // `Request.body` as null even when a body was provided — which would silently
  // drop the payload.
  if (typeof raw === "string") return { data: raw || undefined, binary: false };
  if (raw instanceof URLSearchParams) return { data: String(raw) || undefined, binary: false };
  if (raw == null && !request.body) return { data: undefined, binary: false };
  const blob = await request.blob();
  return { data: blob.size ? blob : undefined, binary: true };
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

  const { data: requestBody, binary } = await readBody(request, init?.body);
  if (request.body && signal.aborted) throw makeAbortError();

  const headers: Record<string, string> = fromEntries(request.headers as any);
  const rawHeaders = init?.headers as any;
  if (rawHeaders && !(rawHeaders instanceof Headers)) {
    // Recover forbidden headers (Cookie, Host, Origin, ...) that the Request
    // constructor strips. Only fill keys missing from request.headers so the
    // already-combined value of repeated non-forbidden headers is preserved.
    if (typeof rawHeaders[Symbol.iterator] === "function")
      for (const [k, v] of rawHeaders) headers[(k as string).toLowerCase()] ??= v;
    else
      for (const k of Object.keys(rawHeaders)) headers[k.toLowerCase()] ??= rawHeaders[k];
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
        data: requestBody,
        binary,
        anonymous: credentials === "omit",
        responseType: "blob" as any,

        onload(ev: any) {
          if (settled) return;
          settled = true;
          signal.removeEventListener(ABORT_EVT, onSignalAbort);
          const { responseHeaders, status, statusText, finalUrl, response: body } = ev;
          if (!status) { reject(netErr(ev)); return; }

          const h = parseHeaders(responseHeaders);
          resolve(stamp(new Response(body as Blob, { headers: h, status, statusText }), url, finalUrl, h));
        },

        onerror(ev: any) { fail(netErr(ev)); },
        ontimeout() { fail(new DOMEx("Timed out", "TimeoutError")); },
        onabort() { fail(makeAbortError()); },
      }));
    } catch (e) {
      fail(e instanceof Error ? e : new TypeErr(String(e)));
    }
  });
}

export default gmFetchLite;
