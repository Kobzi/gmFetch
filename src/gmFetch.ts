// GM_xmlhttpRequest and GM are provided by the userscript engine at runtime.
// Types declared in gm-types.d.ts (ambient).

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GmProxyConfig {
  type: "direct" | "http" | "https" | "socks" | "socks4";
  host: string;
  port: number;
  username?: string;
  password?: string;
  proxyDNS?: boolean;
  failoverTimeout?: number;
  proxyAuthorizationHeader?: string;
  connectionIsolationKey?: string;
}

export interface GmProgressEvent {
  lengthComputable: boolean;
  loaded: number;
  position: number;
  total: number;
  totalSize: number;
  readyState: number;
  responseHeaders: string;
  status: number;
  statusText: string;
  finalUrl: string;
}

export interface GmOptions {
  cookie?: string;
  cookiePartition?: { topLevelSite?: string };
  fetch?: boolean;
  proxy?: GmProxyConfig;
  user?: string;
  password?: string;
  timeout?: number;
  maxRedirects?: number;
  onprogress?: (event: GmProgressEvent) => void;
  onloadstart?: (event: GmProgressEvent) => void;
  /** Upload progress callback. Not available in native fetch. TM 4.x+. */
  onuploadprogress?: (event: GmProgressEvent) => void;
  overrideMimeType?: string;
}

export interface GmFetchInit extends RequestInit {
  gm?: GmOptions;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Alias globals — terser mangles local names but not global property access.
const TypeErr = TypeError, DOMEx = DOMException;
const fromEntries = Object.fromEntries;
const defProp = Object.defineProperty;
const FETCH_ERR = "Failed to fetch", ABORT_EVT = "abort";
const GM_KEYS: readonly string[] = "cookie,cookiePartition,fetch,proxy,user,password,timeout,maxRedirects,onprogress,onloadstart,onuploadprogress,overrideMimeType".split(",");
const RE_FOLD = /\r?\n[\t ]+/g, RE_NEWLINE = /\r?\n/;

// Cross-realm safe ReadableStream detection (sandbox/isolated world resilience).
const isStream = (v: unknown): v is ReadableStream =>
  v != null && typeof (v as any).getReader === "function";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stamp read-only Response properties that the constructor doesn't allow setting. */
function stamp(response: Response, requestUrl: string, finalUrl: string, headers: Headers): Response {
  defProp(response, "url", { value: finalUrl, configurable: true });
  defProp(response, "type", { value: "basic", configurable: true });
  if (requestUrl !== finalUrl) defProp(response, "redirected", { value: true, configurable: true });
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

async function verifyIntegrity(body: ArrayBuffer, integrity: string): Promise<void> {
  const tokens = integrity.trim().split(/\s+/).sort().reverse();
  let prefix: string | undefined;
  const hashes: string[] = [];
  for (const t of tokens) {
    const d = t.indexOf("-");
    if (d < 1) continue;
    const a = t.slice(0, d).toLowerCase();
    if (a !== "sha256" && a !== "sha384" && a !== "sha512") continue;
    if (!prefix) prefix = a;
    if (a === prefix) hashes.push(t.slice(d + 1));
  }
  if (!prefix) throw new TypeErr("gmFetch: no recognized integrity hash");
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-" + prefix.slice(3), body));
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  if (!hashes.includes(btoa(bin)))
    throw new TypeErr("gmFetch: integrity mismatch");
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Drop-in `fetch()` replacement backed by `GM_xmlhttpRequest`.
 *
 * Divergences from Fetch spec:
 * - `redirect: "manual"` won't produce opaqueredirect Response (GM limitation).
 * - `credentials: "same-origin"` behaves like `"include"` (GM is privileged).
 * - `response.type` is always `"basic"` (GM bypasses CORS entirely).
 */
async function gmFetch(input: RequestInfo | URL, init?: GmFetchInit): Promise<Response> {
  const gmXhr = (typeof GM_xmlhttpRequest === "function" && GM_xmlhttpRequest)
    || (typeof GM === "object" && GM?.xmlHttpRequest);
  if (typeof gmXhr !== "function")
    throw new DOMEx("GM_xmlhttpRequest not granted.", "NotFoundError");

  const gm = init?.gm;
  const request = new Request(input, init);
  const { signal, method, url, cache, credentials, redirect, integrity } = request;
  const makeAbortError = (): Error =>
    signal.reason instanceof Error ? signal.reason : new DOMEx("Aborted", "AbortError");

  if (signal.aborted) throw makeAbortError();
  if (cache === "only-if-cached") throw new TypeErr("gmFetch: only-if-cached unsupported");

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

  // Whitelist GM options
  const extras: Record<string, unknown> = {};
  if (gm) for (const k of GM_KEYS) if ((gm as any)[k] !== undefined) extras[k] = (gm as any)[k];

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    let abortGm: (() => void) | undefined;
    const { promise: blobReady, resolve: resolveBlobP } = Promise.withResolvers<Blob | null>();

    const fail = (error: unknown, cancelRequest = false): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener(ABORT_EVT, onSignalAbort);
      reject(error);
      resolveBlobP(null);
      if (cancelRequest) abortGm?.();
    };
    const onSignalAbort = (): void => fail(makeAbortError(), true);
    signal.addEventListener(ABORT_EVT, onSignalAbort);

    const handleResponse = async (ev: any): Promise<void> => {
      if (settled) return;
      try {
        const { responseHeaders, status, statusText, finalUrl, response: body } = ev;
        if (!status) { fail(new TypeErr(FETCH_ERR)); return; }

        const h = parseHeaders(responseHeaders);
        const source = isStream(body) ? body : await blobReady;
        if (settled) return;

        let out: BodyInit | null = source;
        if (integrity) {
          out = isStream(source)
            ? await new Response(source).arrayBuffer()
            : await (source as Blob).arrayBuffer();
          if (settled) return;
          await verifyIntegrity(out, integrity);
          if (settled) return;
        }

        settled = true;
        signal.removeEventListener(ABORT_EVT, onSignalAbort);
        resolve(stamp(new Response(out, { headers: h, status, statusText }), url, finalUrl, h));
      } catch (e) { fail(e, true); }
    };

    try {
      ({ abort: abortGm } = gmXhr({
        method, url, headers, redirect,
        data: requestBody?.size ? requestBody : undefined,
        binary: true,
        nocache: cache === "no-store" || cache === "reload",
        revalidate: cache === "no-cache",
        anonymous: credentials === "omit",
        ...extras,
        responseType: gmXhr.RESPONSE_TYPE_STREAM ?? "blob",
        onload({ response: blob }: any) { resolveBlobP(settled ? null : blob as Blob); },
        onreadystatechange(ev: any) {
          if (settled) return;
          const readyState = ev.readyState;
          if (readyState !== 2 && readyState !== 4) return;
          if (gm?.fetch && readyState === 2) return;
          if (readyState === 4 && !isStream(ev.response)) resolveBlobP(ev.response as Blob);
          handleResponse(ev);
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

export default gmFetch;
