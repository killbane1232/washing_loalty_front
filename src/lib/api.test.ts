import { describe, expect, it } from "vitest";
import { parseQR, validAmount } from "./api";

describe("station inputs", () => {
  it("accepts station codes and extracts QR parameters without navigating to arbitrary URLs", () => {
    expect(parseQR("  post-1  ")).toBe("post-1");
    expect(parseQR("https://example.com/scan?qr=post%20one")).toBe("post one");
    expect(() => parseQR("")).toThrow();
    expect(() => parseQR("bad\ncode")).toThrow();
    expect(() => parseQR("я".repeat(257))).toThrow();
  });
  it("rejects fractions, negatives, unsafe numbers and overdrafts", () => {
    for (const input of [
      "-1",
      "0",
      "1.5",
      "1e2",
      "101",
      "",
      "9007199254740993",
    ])
      expect(validAmount(input, 100)).toBeNull();
    expect(validAmount("25", 100)).toBe(25);
    expect(validAmount("100", 100)).toBe(100);
  });
});
