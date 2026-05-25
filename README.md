# gmFetch

Drop-in `fetch()` replacement for userscripts, powered by `GM_xmlhttpRequest`. Supports cross-origin requests, forbidden headers, cookie injection, proxies, streaming, and upload progress while preserving familiar Fetch API ergonomics.

Available in two variants:
- **Full** (~3.1 KB min) — closely aligned with Fetch spec, SRI, streaming, cache modes, GM options
- **Lite** (~1.9 KB min) — minimal footprint, core fetch semantics only

```ts
// Full
import gmFetch from "@kobzi/gmfetch";

// Lite
import gmFetch from "@kobzi/gmfetch/lite";

// IIFE (classic userscript)
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.iife.min.js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.lite.iife.min.js
```

```ts
const r = await gmFetch("https://api.example.com/data");
const data = await r.json();
```

---

## Full vs Lite

| Feature | Full | Lite |
|---|:---:|:---:|
| Request normalisation (URL, method, body) | ✓ | ✓ |
| AbortSignal / AbortController | ✓ | ✓ |
| Response url / type / redirected / headers | ✓ | ✓ |
| credentials → anonymous mapping | ✓ | ✓ |
| Error semantics (TypeError / DOMException) | ✓ | ✓ |
| SRI integrity verification | ✓ | ✗ |
| Cache mode mapping (no-store / reload / no-cache) | ✓ | ✗ |
| ReadableStream response | ✓ | ✗ |
| Forbidden headers preservation (raw init.headers) | ✓ | ✓ |
| GM options (cookie, proxy, timeout, fetch, etc.) | ✓ | ✗ |
| Early headers via onreadystatechange | ✓ | ✗ |

**Use Lite when:** simple GET/POST requests, no need for GM-specific options (proxy, progress, gm.cookie), size matters.

**Use Full when:** you need GM-specific features (gm.cookie, proxy, timeout, progress), SRI, streaming, or cache control.

---

## Why use it

| Capability | Native `fetch()` | `gmFetch` |
|---|---|---|
| Cross-origin without CORS | ❌ | ✅ |
| Send `Cookie` / `User-Agent` / `Referer` / `Origin` | ❌ stripped | ✅ |
| Read `Set-Cookie` from response | ❌ | ✅ |
| Inject cookies (`gm.cookie`) | ❌ | ✅ (full) |
| HTTP Basic Auth fields | ❌ header only | ✅ (full) `gm.user` / `gm.password` |
| CHIPS partitioned cookies | ❌ | ✅ (full) `gm.cookiePartition` |
| HTTP/SOCKS proxy (Firefox) | ❌ | ✅ (full) `gm.proxy` |
| Override response MIME | ❌ | ✅ (full) `gm.overrideMimeType` |
| SRI integrity verification | ❌ | ✅ (full) |
| Background fetch (Chrome MV3) | ❌ | ✅ (full) `gm.fetch` |
| Upload progress | ❌ | ✅ (full) `gm.onuploadprogress` |

---

## Installation

### Bundler (ES module)

```ts
import gmFetch from "@kobzi/gmfetch";       // full
import gmFetch from "@kobzi/gmfetch/lite";   // lite
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

Or for lite:
```js
// @require https://cdn.jsdelivr.net/npm/@kobzi/gmfetch@latest/dist/gmFetch.lite.iife.min.js
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

| Field | Full | Lite | Behaviour |
|---|:---:|:---:|---|
| `method` | ✓ | ✓ | As-is. `CONNECT`/`TRACE`/`TRACK` rejected per spec. |
| `headers` | ✓ | ✓ | Forbidden headers preserved when passed as plain object/tuples (not `Headers` instance). |
| `body` | ✓ | ✓ | Buffered as Blob, sent with `binary: true`. |
| `credentials` | ✓ | ✓ | `"omit"` → `anonymous: true`. Others use GM defaults. |
| `cache` | ✓ | ✗ | `"no-store"`/`"reload"` → `nocache`. `"no-cache"` → `revalidate`. `"only-if-cached"` → rejected. |
| `redirect` | ✓ | ✓ | `"follow"`, `"error"`, `"manual"` passed to GM. |
| `signal` | ✓ | ✓ | AbortSignal with `reason` propagation. Cancels GM request. |
| `integrity` | ✓ | ✗ | SRI verification (sha256/384/512). |

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

Sending cookies via `headers` works in **both** variants. The `gm.cookie` option (additive patching) is full only.

| Goal | Use | Variant |
|---|---|---|
| Send exact cookies, ignore browser session | `credentials: "omit"` + `headers: { Cookie: "..." }` | both |
| Add cookies on top of browser session | `gm: { cookie: "..." }` (additive) | full |
| Browser session as-is | default (nothing) | both |

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

Both produce `DOMException` with name `"TimeoutError"` or `"AbortError"`.

---

## Errors

| Cause | Error |
|---|---|
| GM not granted | `DOMException("...", "NotFoundError")` |
| Abort / signal | `DOMException("...", "AbortError")` or signal's `reason` |
| Timeout | `DOMException("...", "TimeoutError")` |
| Network / DNS / `@connect` | `TypeError("Failed to fetch")` |
| `status: 0` | `TypeError("Failed to fetch")` |
| SRI mismatch (full) | `TypeError("gmFetch: integrity mismatch")` |
| `only-if-cached` (full) | `TypeError("gmFetch: only-if-cached unsupported")` |

---

## Examples

### POST JSON (both variants)

```ts
const r = await gmFetch("https://api.example.com/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "thing" }),
});
```

### Forbidden headers (both variants)

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
- Request body streaming — all bodies are serialized to Blob before dispatch.

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
├── gmFetch.esm.min.js         3.1 KB  (full, ESM)
├── gmFetch.iife.min.js        3.1 KB  (full, IIFE)
├── gmFetch.lite.esm.min.js    1.8 KB  (lite, ESM)
├── gmFetch.lite.iife.min.js   1.8 KB  (lite, IIFE)
├── gmFetch.d.ts               (types, full)
└── gmFetch.lite.d.ts          (types, lite)
```

Sizes (esbuild + terser, minified, no gzip):

| Variant | ESM | IIFE |
|---|---|---|
| Full | 3.1 KB | 3.1 KB |
| Lite | 1.8 KB | 1.8 KB |

For comparison (IIFE, minified):
| Library | Size | Notes |
|---|---|---|
| **@kobzi/gmfetch lite** | **1.8 KB** | own terser build, more correct |
| @sec-ant/gm-fetch | 1.9 KB | includes vite-plugin-monkey runtime |
| @trim21/gm-fetch | 2.1 KB | minified by jsdelivr (no own min build) |
| **@kobzi/gmfetch full** | **3.1 KB** | own terser build, full GM API surface |

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
```

Requires `lib: ["DOM"]` (or any superset like `["ES2020", "DOM"]`). For IIFE usage, add a `.d.ts` with `declare function gmFetch(...)`.

---

## Background

Inspired by [@sec-ant/gm-fetch](https://www.npmjs.com/package/@sec-ant/gm-fetch) and [@trim21/gm-fetch](https://www.npmjs.com/package/@trim21/gm-fetch). This library goes further — carefully aligned Fetch semantics, preserved forbidden headers, full GM API surface, SRI integrity, and a lite variant for size-conscious scripts.

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
