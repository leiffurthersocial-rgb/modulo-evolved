import { gunzipSync, gzipSync, strFromU8, strToU8, deflateSync, inflateSync } from "fflate";

export function gzipJson(obj: unknown): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(obj)), { level: 6 });
}

export function gunzipJson<T>(data: Uint8Array): T {
  return JSON.parse(strFromU8(gunzipSync(data))) as T;
}

/** Compact URL-safe encoding: deflate → base64url. */
export function encodeUrl(obj: unknown): string {
  const bytes = deflateSync(strToU8(JSON.stringify(obj)), { level: 9 });
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeUrl<T>(s: string): T {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(strFromU8(inflateSync(bytes))) as T;
}

export function download(name: string, data: Uint8Array | string, type: string) {
  const blob = new Blob([typeof data === "string" ? data : (data as BlobPart)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
