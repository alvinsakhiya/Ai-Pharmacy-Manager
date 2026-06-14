import { describe, expect, it } from "vitest";
import {
  FALLBACK_DIRECTIONS,
  appendDirection,
  filterDirections,
} from "./trustedDirections";

describe("trusted directions", () => {
  it("ranks an exact shortcut before text matches", () => {
    const rows = [
      ...FALLBACK_DIRECTIONS,
      { code: "XOD", text: "OD support phrase" },
    ];
    expect(filterDirections(rows, "OD")[0].code).toBe("OD");
  });

  it("searches visible direction text", () => {
    expect(filterDirections(FALLBACK_DIRECTIONS, "bedtime")[0].code).toBe("ON");
  });

  it("composes selected phrases into a readable instruction", () => {
    expect(appendDirection("Take one tablet", "At bedtime")).toBe(
      "Take one tablet; at bedtime"
    );
  });
});
