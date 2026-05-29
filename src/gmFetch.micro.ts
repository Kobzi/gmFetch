// Micro fetch() replacement — absolute minimum for simple GET/POST in userscripts.
// No AbortSignal, no timeout, no forbidden headers, no RFC 7230 folding.
// For when you just need to grab some JSON.

export interface GmFetchMicroInit extends RequestInit {}

async function gmFetchMicro(input: RequestInfo | URL, init?: GmFetchMicroInit): Promise<Response> {
  const gmXhr = (typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : GM?.xmlHttpRequest)!;

  const request = new Request(input, init);
  // Text bodies (string, URLSearchParams) go as-is so the server gets a normal
  // text/JSON/form payload, not a binary blob upload. Other bodies buffer to Blob.
  const raw = init?.body;
  const text = typeof raw === "string" || raw instanceof URLSearchParams;
  const blob = !text && request.body ? await request.blob() : undefined;
  const data = text ? String(raw) || undefined : (blob?.size ? blob : undefined);

  return new Promise<Response>((resolve, reject) => {
    const fail = () => reject(new TypeError("Failed to fetch"));
    gmXhr({
      method: request.method,
      url: request.url,
      redirect: request.redirect,
      headers: Object.fromEntries(request.headers as any),
      data,
      binary: !text,
      anonymous: request.credentials === "omit",
      responseType: "blob" as any,

      onload(ev: any) {
        if (!ev.status) return fail();
        const h = new Headers();
        // Token header names only; Headers.append() normalizes the value (trims OWS/CR).
        for (const m of (ev.responseHeaders || "").matchAll(/^([\w-]+):(.*)/gm))
          try { h.append(m[1], m[2]); } catch {}
        const r = new Response(ev.response as Blob, { headers: h, status: ev.status, statusText: ev.statusText });
        Object.defineProperty(r, "url", { value: ev.finalUrl });
        resolve(r);
      },

      onerror: fail,
    });
  });
}

export default gmFetchMicro;
