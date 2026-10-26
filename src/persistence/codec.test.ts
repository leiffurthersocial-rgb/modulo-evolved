import { describe, expect, it } from "vitest";
import { decodeUrl, encodeUrl, gunzipJson, gzipJson } from "./codec";

describe("codecs", () => {
  it("round-trips URL payloads compactly", () => {
    const payload = {
      v: 1,
      scenario: "archipelago",
      seed: 1234,
      env: { temperature: 16, list: Array.from({ length: 200 }, (_, i) => i % 7) },
    };
    const s = encodeUrl(payload);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s.length).toBeLessThan(JSON.stringify(payload).length);
    expect(decodeUrl(s)).toEqual(payload);
  });
  it("round-trips gzip JSON", () => {
    const obj = { a: [1, 2, 3], b: "modulo" };
    expect(gunzipJson(gzipJson(obj))).toEqual(obj);
  });
});
