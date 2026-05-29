# gmFetch

Drop-in `fetch()` replacement for userscripts, powered by `GM_xmlhttpRequest`. Supports cross-origin requests, forbidden headers, cookie injection, proxies, streaming, and upload progress while preserving familiar Fetch API ergonomics.

Available in three variants:
- **Full** (~3.3 KB min, ~1.7 KB gzip) — closely aligned with Fetch spec, SRI, streaming, cache modes, GM options
- **Lite** (~2.0 KB min, ~1.0 KB gzip) — core fetch semantics, AbortSignal, forbidden headers
- **Micro** (~0.8 KB min, ~0.5 KB gzip) — absolute minimum for simple GET/POST, no abort, no timeout

```ts
// Full
import gmFetch from "@kobzi/gmfetch";

// Lite
import gmFetch from "@kobzi/gmfetch/lite";

// Micro
import gmFetch from "@kobzi/gmfetch/micro";

// IIFE (classic userscript)
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.iife.min.js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.lite.iife.min.js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.micro.iife.min.js
```

```ts
const r = await gmFetch("https://api.example.com/data");
const data = await r.json();
```

---

## Full vs Lite vs Micro

| Feature | Full | Lite | Micro |
|---|:---:|:---:|:---:|
| Request normalisation (URL, method, body) | ✓ | ✓ | ✓ |
| Native Response (ok, json, blob, clone) | ✓ | ✓ | ✓ |
| Response url | ✓ | ✓ | ✓ |
| credentials → anonymous mapping | ✓ | ✓ | ✓ |
| redirect passthrough | ✓ | ✓ | ✓ |
| Binary body support | ✓ | ✓ | ✓ |
| Text body sent as-is (no forced Blob) | ✓ | ✓ | ✓ |
| status:0 → TypeError | ✓ | ✓ | ✓ |
| AbortSignal / AbortController | ✓ | ✓ | ✗ |
| Forbidden headers preservation | ✓ | ✓ | ✗ |
| RFC 7230 header folding | ✓ | ✓ | ✗ |
| Response type / redirected / set-cookie | ✓ | ✓ | ✗ |
| Error semantics (DOMException types) | ✓ | ✓ | ✗ |
| Cache mode mapping | ✓ | ✗ | ✗ |
| ReadableStream response | ✓ | ✗ | ✗ |
| SRI integrity verification | ✓ | ✗ | ✗ |
| GM options (cookie, proxy, timeout, etc.) | ✓ | ✗ | ✗ |
| Upload/download progress | ✓ | ✗ | ✗ |
| Early headers via onreadystatechange | ✓ | ✗ | ✗ |

**Use Micro when:** simple GET/POST, grab JSON, size is everything, no abort needed.

**Use Lite when:** need AbortSignal, forbidden headers (Cookie/UA), proper error handling.

**Use Full when:** need GM-specific features, SRI, streaming, cache control, progress events.

---

## Installation

### Bundler (ES module)

```ts
import gmFetch from "@kobzi/gmfetch";       // full
import gmFetch from "@kobzi/gmfetch/lite";   // lite
import gmFetch from "@kobzi/gmfetch/micro";  // micro
```

### CDN (IIFE, no bundler)

```js
// ==UserScript==
// @grant   GM_xmlhttpRequest
// @connect example.com
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.iife.min.js
// ==/UserScript==

const r = await gmFetch("https://example.com/api");
```

Or for lite/micro:
```js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.lite.iife.min.js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.micro.iife.min.js
```

The IIFE exposes `gmFetch` as a global. Pin to a specific version for stability.

`@grant GM_xmlhttpRequest` (or `GM.xmlHttpRequest`) required. `@connect <domain>` required for cross-origin.

### Compatibility

| Engine | Support |
|---|---|
| Tampermonkey 4.x+ | Full. `gm.proxy` needs 5.5+ (FF). `gm.cookiePartition` needs 5.2+. |
| Violentmonkey 2.13+ | Works. No `gm.proxy`/`gm.cookiePartition`/`gm.fetch`. |
| Greasemonkey 4.x | Partial. Uses `GM.xmlHttpRequest`. No streaming, no `redirect`/`nocache`/`revalidate`/`anonymous`/`cookie`/`proxy`/`fetch`/`maxRedirects`. |

Runtime: `crypto.subtle` (for SRI, full only).

---

## API

```ts
function gmFetch(input: RequestInfo | URL, init?: GmFetchInit): Promise<Response>
```

Signature matches `window.fetch()`. The full version extends `init` with an optional `gm` field:

```ts
interface GmFetchInit extends RequestInit {
  gm?: GmOptions;  // full only
}
```

### Standard `RequestInit` fields

| Field | Full | Lite | Micro | Behaviour |
|---|:---:|:---:|:---:|---|
| `method` | ✓ | ✓ | ✓ | As-is. `CONNECT`/`TRACE`/`TRACK` rejected per spec. |
| `headers` | ✓ | ✓ | ✓ | Full/Lite: forbidden headers preserved (plain object/tuples). Micro: normalised via Request only. |
| `body` | ✓ | ✓ | ✓ | Text (string/`URLSearchParams`) sent as-is; other types buffered as Blob with `binary: true`. |
| `credentials` | ✓ | ✓ | ✓ | `"omit"` → `anonymous: true`. Others use GM defaults. |
| `cache` | ✓ | ✗ | ✗ | `"no-store"`/`"reload"` → `nocache`. `"no-cache"` → `revalidate`. `"only-if-cached"` → rejected. |
| `redirect` | ✓ | ✓ | ✓ | `"follow"`, `"error"`, `"manual"` passed to GM. |
| `signal` | ✓ | ✓ | ✗ | AbortSignal with `reason` propagation. Cancels GM request. |
| `integrity` | ✓ | ✗ | ✗ | SRI verification (sha256/384/512). |

### `GmOptions` — the `gm` field (full only)

Only whitelisted keys are forwarded (protects internal callbacks):

| Field | Description |
|---|---|
| `cookie` | Patch cookies into request set (additive, not replacing). |
| `cookiePartition` | CHIPS: `{ topLevelSite: "https://..." }`. TM 5.2+. |
| `fetch` | Background fetch via TM service worker (Chrome MV3). |
| `proxy` | `{ type, host, port, username?, password? }`. TM 5.5+, Firefox. |
| `user` / `password` | HTTP Basic Auth. |
| `timeout` | Ms. Immune to tab throttling. `0` = none. |
| `maxRedirects` | Max redirects to follow. `0` = don't follow. TM 6180+. |
| `onprogress` | Download progress callback. |
| `onloadstart` | Load-start callback. |
| `onuploadprogress` | Upload progress callback. Not available in native fetch. TM 4.x+. |
| `overrideMimeType` | Force response MIME (e.g. `"text/html; charset=gbk"`). |

---

## Request body

The body is sent in the format that matches its type, so servers receive what they expect:

| Body type | Sent as | `binary` |
|---|---|:---:|
| `string` (e.g. `JSON.stringify(...)`) | text, as-is | `false` |
| `URLSearchParams` | text, as-is | `false` |
| `Blob` / `File` | buffered Blob | `true` |
| `ArrayBuffer` / `TypedArray` / `DataView` | buffered Blob | `true` |
| `FormData` | buffered Blob (multipart) | `true` |

Text bodies are forwarded directly rather than wrapped in a Blob with `binary: true`. This matters because some servers reject or mishandle binary blob uploads when they expect a plain JSON/form payload. The `Content-Type` computed by the `Request` constructor is always included in the request headers regardless of body type.

```ts
// Sent as a normal JSON text body, not a binary blob
await gmFetch("https://api.example.com/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "thing" }),
});
```

Empty bodies are omitted entirely (no empty Blob or empty string is dispatched). Applies to all three variants.

---

## Headers

Pass as **plain object** or **array of tuples** to preserve forbidden headers:

```ts
await gmFetch("https://example.com", {
  headers: {
    "Cookie": "session=abc",
    "User-Agent": "Custom/1.0",
    "Referer": "https://other.com",
  },
});
```

> ⚠️ `new Headers({ Cookie: "x" })` strips forbidden headers at construction. Use plain objects.

### Response `Set-Cookie`

```ts
const r = await gmFetch("https://example.com/login", { method: "POST" });
const cookies = r.headers.getSetCookie(); // ["session=abc; HttpOnly", ...]
```

> Note: Set-Cookie availability depends on userscript engine and browser. Tampermonkey exposes it; other engines may vary.

---

## Cookies

Sending cookies via `headers` works in **full and lite** (forbidden headers preserved). In micro, cookies via `headers` only work if the browser doesn't strip them (use full/lite for reliable cookie injection). The `gm.cookie` option (additive patching) is full only.

| Goal | Use | Variant |
|---|---|---|
| Send exact cookies, ignore browser session | `credentials: "omit"` + `headers: { Cookie: "..." }` | full, lite |
| Add cookies on top of browser session | `gm: { cookie: "..." }` (additive) | full |
| Browser session as-is | default (nothing) | all |

---

## Timeouts and abort

```ts
// AbortSignal (standard) — works in both full and lite
await gmFetch(url, { signal: AbortSignal.timeout(5000) });

// gm.timeout — immune to tab throttling (full only)
await gmFetch(url, { gm: { timeout: 5000 } });

// Manual abort
const ctrl = new AbortController();
gmFetch(url, { signal: ctrl.signal });
ctrl.abort();
```

All produce `DOMException` with name `"TimeoutError"` or `"AbortError"` (full and lite only — micro has no abort/timeout support).

---

## Errors

| Cause | Error |
|---|---|
| GM not granted | `DOMException("...", "NotFoundError")` (full/lite). Micro throws a plain `TypeError`. |
| Abort / signal | `DOMException("...", "AbortError")` or signal's `reason` |
| Timeout | `DOMException("...", "TimeoutError")` |
| Network / DNS / `@connect` | `TypeError("Failed to fetch")` |
| `status: 0` | `TypeError("Failed to fetch")` |
| SRI mismatch (full) | `TypeError("gmFetch: integrity mismatch")` |
| `only-if-cached` (full) | `TypeError("gmFetch: only-if-cached unsupported")` |

The `message` is kept spec-generic (native `fetch` never leaks network failure details). For debugging, network errors (`onerror` and `status: 0`) attach the raw GM event on `error.cause` in **full and lite**, so you can inspect `status`, `statusText`, `finalUrl`, `responseHeaders`, etc.:

```ts
try {
  await gmFetch("https://example.com");
} catch (e) {
  console.error(e.message);        // "Failed to fetch"
  console.error(e.cause?.error);   // GM-provided detail, if any
  console.error(e.cause?.finalUrl);
}
```

> Micro throws a bare `TypeError("Failed to fetch")` with no `cause`.

---

## Examples

### POST JSON (all variants)

```ts
const r = await gmFetch("https://api.example.com/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "thing" }),
});
```

### Forbidden headers (full and lite)

```ts
const r = await gmFetch("https://example.com/protected", {
  headers: {
    "Cookie": "session=abc; user_id=42",
    "User-Agent": "Mozilla/5.0 (custom)",
    "Referer": "https://example.com/login",
  },
});
```

### Progress reporting (full)

```ts
// Download progress
await gmFetch("https://example.com/big.zip", {
  gm: {
    onprogress: ({ loaded, total, lengthComputable }) => {
      if (lengthComputable) console.log(`Download: ${(loaded / total * 100).toFixed(1)}%`);
    },
  },
});

// Upload progress — not available in native fetch!
await gmFetch("https://example.com/upload", {
  method: "POST",
  body: largeBlob,
  gm: {
    onuploadprogress: ({ loaded, total }) => {
      console.log(`Upload: ${(loaded / total * 100).toFixed(1)}%`);
    },
  },
});
```

### Streaming (full)

```ts
const r = await gmFetch("https://example.com/stream");
const reader = r.body!.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process(value);
}
```

### Proxy (full, Firefox, TM 5.5+)

```ts
await gmFetch("https://example.com", {
  gm: { proxy: { type: "socks", host: "127.0.0.1", port: 9050, proxyDNS: true } },
});
```

### SRI integrity (full)

```ts
const r = await gmFetch("https://cdn.example.com/lib.js", {
  integrity: "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb",
});
```

### Full example (CDN/IIFE)

```js
// ==UserScript==
// @name        Scraper
// @grant       GM_xmlhttpRequest
// @connect     api.example.com
// @require     https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.iife.min.js
// ==/UserScript==

(async () => {
  const r = await gmFetch("https://api.example.com/data", {
    method: "POST",
    headers: { "Cookie": "auth=abc", "User-Agent": "Bot/1.0" },
    body: JSON.stringify({ query: "test" }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
    gm: { onprogress: ({ loaded }) => console.log(loaded) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  console.log(await r.json());
})();
```

### Lite example

```js
// ==UserScript==
// @name        Simple Fetch
// @grant       GM_xmlhttpRequest
// @connect     api.example.com
// @require     https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.lite.iife.min.js
// ==/UserScript==

(async () => {
  const r = await gmFetch("https://api.example.com/data", {
    method: "POST",
    headers: { "Cookie": "auth=abc", "Content-Type": "application/json" },
    body: JSON.stringify({ query: "test" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  console.log(await r.json());
})();
```

---

## Limitations

**Silently ignored** (no GM equivalent): `mode`, `referrer`, `referrerPolicy`, `keepalive`, `priority`, `window`. Note: the `Referer` *header* can still be set manually via `headers: { "Referer": "..." }` — only the automatic policy fields are ignored.

**Not supported** (GM_xmlhttpRequest limitation):
- `duplex: "half"` — upload streaming is not possible; body is always fully buffered before sending.
- `response.trailer` — HTTP trailers are not exposed by GM.
- Request body streaming — bodies are never streamed. Text bodies (string, `URLSearchParams`) are passed through as-is; binary bodies (Blob, `ArrayBuffer`, typed arrays, `FormData`) are buffered to a Blob before dispatch.

**Spec-divergent:**
- `redirect: "manual"` — returns 3xx with readable `Location` header (spec says opaque response with `status: 0`). GM gives *more* info than spec allows.
- `cache: "force-cache"` — falls back to default (no GM equivalent)
- `credentials: "same-origin"` — behaves like `"include"` (GM is privileged)
- `response.type` — always `"basic"` (GM bypasses CORS entirely)
- `response.clone()` — works for blob responses; may fail for streaming responses depending on TM/browser implementation details.

---

## Building

```bash
npm install
npm run build
```

Output:
```
dist/
├── gmFetch.esm.min.js          3364 B  (full, ESM)
├── gmFetch.iife.min.js         3383 B  (full, IIFE)
├── gmFetch.lite.esm.min.js     2036 B  (lite, ESM)
├── gmFetch.lite.iife.min.js    2055 B  (lite, IIFE)
├── gmFetch.micro.esm.min.js     808 B  (micro, ESM)
├── gmFetch.micro.iife.min.js    813 B  (micro, IIFE)
├── gmFetch.d.ts                (types, full)
├── gmFetch.lite.d.ts           (types, lite)
└── gmFetch.micro.d.ts          (types, micro)
```

Sizes (esbuild + terser, minified):

| Variant | Raw (ESM) | Raw (IIFE) | Gzip (IIFE) | Brotli (IIFE) |
|---|---:|---:|---:|---:|
| Full | 3364 B | 3383 B | 1723 B | 1530 B |
| Lite | 2036 B | 2055 B | 1051 B | 925 B |
| Micro | 808 B | 813 B | 524 B | 442 B |

For comparison (IIFE, minified):
| Library | Size | Notes |
|---|---|---|
| **@kobzi/gmfetch micro** | **~0.8 KB** | absolute minimum, no abort |
| gmxhr-fetch | 0.9 KB | ultra-minimal, no AbortSignal, no types, unmaintained |
| @sec-ant/gm-fetch | 1.9 KB | includes vite-plugin-monkey runtime |
| **@kobzi/gmfetch lite** | **2.0 KB** | own terser build, more correct |
| @trim21/gm-fetch | 2.1 KB | minified by jsdelivr (no own min build) |
| **@kobzi/gmfetch full** | **3.3 KB** | own terser build, full GM API surface |
| @uwx/gm-fetch | 12.4 KB | not minified, custom Response class |

Pipeline: `esbuild` (bundle + minify, target `es2024`) → `terser` (3-pass compress + toplevel mangle).

The build targets ES2024 (modern browsers). If you need to support older environments, fork and change `--target` in `package.json` scripts.

Zero runtime dependencies. Dev: `esbuild` + `terser` + `typescript`.

---

## TypeScript

```ts
// Full
import gmFetch, {
  type GmFetchInit,
  type GmOptions,
  type GmProxyConfig,
  type GmProgressEvent,
} from "@kobzi/gmfetch";

// Lite
import gmFetch, { type GmFetchLiteInit } from "@kobzi/gmfetch/lite";

// Micro
import gmFetch, { type GmFetchMicroInit } from "@kobzi/gmfetch/micro";
```

Requires `lib: ["ES2024", "DOM"]`. For IIFE usage, add a `.d.ts` with `declare function gmFetch(...)`.

---

## Background

Inspired by [@sec-ant/gm-fetch](https://www.npmjs.com/package/@sec-ant/gm-fetch) and [@trim21/gm-fetch](https://www.npmjs.com/package/@trim21/gm-fetch). This library goes further — carefully aligned Fetch semantics, preserved forbidden headers, full GM API surface, SRI integrity, and a lite variant for size-conscious scripts.

---

## Comparison

| Feature | Fetch spec | GM specific | **@kobzi full** | **@kobzi lite** | **@kobzi micro** | @sec-ant | @trim21 | gmxhr-fetch | @uwx/gm-fetch |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Size (IIFE, min)** | — | — | **3.3 KB** | **2.0 KB** | **~0.8 KB** | 1.9 KB | 2.1 KB | 0.9 KB | 12.4 KB |
| **Dependencies** | — | — | 0 | 0 | 0 | vite-plugin-monkey | 0 | 0 | 0 |
| Request normalisation | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| AbortSignal + cleanup | ✓ | | ✓ | ✓ | ✗ | ⚠️ leak | ⚠️ leak | ✗ | ✗ |
| signal.reason propagation | ✓ | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Double-settle guard | ✓ | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| status:0 → TypeError | ✓ | | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Timeout → TimeoutError | ✓ | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Forbidden headers | | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Response url/type/redirected | ✓ | | ✓ | ✓ | url only | ✓ | ⚠️ inverted | ✗ | ✓ |
| Set-Cookie preservation | | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| credentials → anonymous | ✓ | | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| redirect passthrough | ✓ | | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Cache mode mapping | ✓ | | ✓ | ✗ | ✗ | ⚠️ partial | ✗ | ✗ | ✗ |
| ReadableStream response | ✓ | | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| SRI integrity | ✓ | | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| GM options (cookie, proxy, etc.) | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Upload progress | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Download progress | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Background fetch (MV3) | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| maxRedirects | | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Binary body support | ✓ | | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Empty body → undefined (no empty Blob sent) | ✓ | | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| RFC 7230 header folding | ✓ | | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| onerror → generic TypeError (spec) | ✓ | | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cross-realm stream detection | | ✓ | ✓ | — | — | ✗ | — | — | — |
| TypeScript types included | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Last updated | | | 2026 | 2026 | 2026 | 2025 | 2025 | 2022 | 2020 |
| duplex (upload streaming) | ✓ | | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| mode (cors/no-cors/same-origin) | ✓ | | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ |
| referrer / referrerPolicy | ✓ | | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ |
| keepalive | ✓ | | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ |
| priority | ✓ | | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ | ✗¹ |
| opaqueredirect response | ✓ | | ✗² | ✗² | ✗² | ✗² | ✗² | ✗² |
| response.trailer | ✓ | | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

¹ Silently ignored — no GM_xmlhttpRequest equivalent exists.
² GM returns full 3xx response with headers/body instead of opaque redirect.

**Key advantages over alternatives:**
- vs @sec-ant: forbidden headers support, AbortSignal cleanup (no memory leak), signal.reason propagation, no vite-plugin-monkey dependency
- vs @trim21: correct binary body handling (trim21 corrupts via `.text()`), proper header parsing, correct `redirected` flag, Set-Cookie access, smaller when minified
- vs gmxhr-fetch: AbortSignal, Request normalisation, Response properties, TypeScript, error semantics — gmxhr-fetch is a bare-minimum wrapper with no spec compliance
- vs @uwx/gm-fetch: 4x smaller (3.3 vs 12.4 KB), minified build included, no custom Response class overhead

---

## Security model

gmFetch runs through the userscript manager's privileged networking layer. This means:

- CORS restrictions do not apply
- Forbidden request headers can be sent freely
- Cookies may be injected or observed across origins
- Requests bypass page-level CSP and fetch restrictions

Users are responsible for respecting website policies, privacy, and applicable laws.

---

## License

MIT.
