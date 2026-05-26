// Micro fetch() replacement — absolute minimum for simple GET/POST in userscripts.
// No AbortSignal, no timeout, no forbidden headers, no RFC 7230 folding.
// For when you just need to grab some JSON.

export interface GmFetchMicroInit extends RequestInit {}

async function gmFetchMicro(input: RequestInfo | URL, init?: GmFetchMicroInit): Promise<Response> {
  const gmXhr = (typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest
    : (typeof GM === "object" ? GM?.xmlHttpRequest : undefined))!;

  const request = new Request(input, init);
  const body = request.body ? await request.blob() : undefined;

  return new Promise<Response>((resolve, reject) => {
    gmXhr({
      method: request.method,
      url: request.url,
      redirect: request.redirect,
      headers: Object.fromEntries(request.headers as any),
      data: body?.size ? body : undefined,
      binary: true,
      anonymous: request.credentials === "omit",
      responseType: "blob" as any,

      onload(ev: any) {
        if (!ev.status) { reject(new TypeError("Failed to fetch")); return; }
        const h = new Headers();
        for (const line of (ev.responseHeaders || "").split("\r\n")) {
          const c = line.indexOf(":");
          if (c > 0) try { h.append(line.slice(0, c).trim(), line.slice(c + 1).trim()); } catch {}
        }
        const r = new Response(ev.response as Blob, { headers: h, status: ev.status, statusText: ev.statusText });
        Object.defineProperty(r, "url", { value: ev.finalUrl, configurable: true });
        resolve(r);
      },

      onerror() { reject(new TypeError("Failed to fetch")); },
    });
  });
}

export default gmFetchMicro;
