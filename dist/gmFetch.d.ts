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
    cookiePartition?: {
        topLevelSite?: string;
    };
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
/**
 * Drop-in `fetch()` replacement backed by `GM_xmlhttpRequest`.
 *
 * Divergences from Fetch spec:
 * - `redirect: "manual"` won't produce opaqueredirect Response (GM limitation).
 * - `credentials: "same-origin"` behaves like `"include"` (GM is privileged).
 * - `response.type` is always `"basic"` (GM bypasses CORS entirely).
 */
declare function gmFetch(input: RequestInfo | URL, init?: GmFetchInit): Promise<Response>;
export default gmFetch;
