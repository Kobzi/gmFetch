export interface GmFetchMicroInit extends RequestInit {
}
declare function gmFetchMicro(input: RequestInfo | URL, init?: GmFetchMicroInit): Promise<Response>;
export default gmFetchMicro;
