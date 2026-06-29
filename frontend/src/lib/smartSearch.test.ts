import { describe, expect, it } from "vitest";

import {
  dateSearchVariants,
  matchesSearchTokens,
  normalizeSearchText,
  suggestionsFor,
} from "./smartSearch";

describe("smartSearch", () => {
  const patientFields = [
    "SUT-POL-001",
    "Polish",
    "Matthew",
    ...dateSearchVariants("1980-01-01"),
  ];

  it.each(["po", "ma", "po ma", "polish", "matt"])(
    "matches patient name token %s",
    (query) => {
      expect(matchesSearchTokens(query, patientFields)).toBe(true);
    },
  );

  it.each(["1980-01-01", "01/01/1980", "1 Jan 1980", "1st Jan 1980", "01011980"])(
    "matches patient DOB variant %s",
    (query) => {
      expect(matchesSearchTokens(query, patientFields)).toBe(true);
    },
  );

  it("normalises punctuation and spacing", () => {
    expect(normalizeSearchText("  Ibu-profen  200mg! ")).toBe("ibu profen 200mg");
  });

  it("limits relevant suggestions", () => {
    const suggestions = suggestionsFor({
      items: [
        { id: 1, name: "Ibuprofen 200mg tablets" },
        { id: 2, name: "Ibuprofen 400mg tablets" },
        { id: 3, name: "Paracetamol 500mg tablets" },
      ],
      query: "ibu",
      getId: (item) => item.id,
      getLabel: (item) => item.name,
      getFields: (item) => [item.name],
      limit: 1,
    });

    expect(suggestions).toEqual([
      { id: "1", label: "Ibuprofen 200mg tablets", description: undefined },
    ]);
  });
});
