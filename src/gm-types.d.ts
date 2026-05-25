/**
 * Ambient type declarations for GM_xmlhttpRequest APIs.
 * These are provided by the userscript engine at runtime.
 * This file replaces the vite-plugin-monkey/dist/client import for standalone builds.
 */

declare const GM_xmlhttpRequest: GMXmlHttpRequestFunc | undefined;

declare const GM: {
  xmlHttpRequest?: GMXmlHttpRequestFunc;
} | undefined;

interface GMXmlHttpRequestFunc {
  (options: any): { abort: () => void };
  RESPONSE_TYPE_STREAM?: string;
}
