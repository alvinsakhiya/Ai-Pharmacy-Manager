/**
 * Patient search tests — exercises the multi-format matcher and the
 * similar-spelling tier (Connor / Conner / Connors cluster).
 */
import { describe, it, expect } from "vitest";
import { searchPatients, suggestRepeatCycle, getTray, PATIENTS } from "./patientData";

const surnames = (rows) => rows.map((r) => r.surname);

describe("searchPatients — direct matching", () => {
  it("matches an exact surname and does not flag it as fuzzy", () => {
    const rows = searchPatients("connor");
    const exact = rows.find((r) => r.surname === "Connor");
    expect(exact).toBeTruthy();
    expect(exact._fuzzy).toBe(false);
  });

  it("matches by patient ID", () => {
    const rows = searchPatients("PT-12051");
    expect(rows[0].surname).toBe("Conner");
  });

  it("matches by postcode", () => {
    const rows = searchPatients("LE3 2BB");
    expect(rows.some((r) => r.surname === "Connor")).toBe(true);
  });

  it("matches by date of birth in dd/mm/yyyy form", () => {
    const rows = searchPatients("22/04/1967");
    expect(rows[0].surname).toBe("Conner");
  });

  it("returns nothing for an empty query", () => {
    expect(searchPatients("")).toEqual([]);
  });
});

describe("searchPatients — similar-spelling tier", () => {
  it("surfaces near-identical surnames together, flagged as similar", () => {
    const rows = searchPatients("conner");
    const found = surnames(rows);
    expect(found).toEqual(expect.arrayContaining(["Connor", "Conner", "Connors"]));

    // The exact match is not fuzzy; the neighbours are flagged.
    expect(rows.find((r) => r.surname === "Conner")._fuzzy).toBe(false);
    expect(rows.find((r) => r.surname === "Connor")._fuzzy).toBe(true);
    expect(rows.find((r) => r.surname === "Connors")._fuzzy).toBe(true);
  });

  it("ranks the exact match above the similar ones", () => {
    const rows = searchPatients("conner");
    // First Conner-family result returned should be the exact surname.
    const family = rows.filter((r) => r.surname.startsWith("Conn"));
    expect(family[0].surname).toBe("Conner");
  });

  it("does not fuzzy-match unrelated surnames", () => {
    const rows = searchPatients("conner");
    expect(rows.some((r) => r.surname === "Sakhiya")).toBe(false);
    expect(rows.some((r) => r.surname === "Hayes")).toBe(false);
  });
});

describe("suggestRepeatCycle — repeat dosette draft", () => {
  // Regression: previously read m.audit (undefined) and threw. Must not throw
  // for any patient, and must return a usable draft.
  it("returns a draft for every patient without throwing", () => {
    for (const p of PATIENTS) {
      const draft = suggestRepeatCycle(p);
      expect(draft.nextCycle).toBeTruthy();
      expect(draft.nextCycle.start).toBeTruthy();
      expect(draft.nextCycle.end).toBeTruthy();
      expect(Array.isArray(draft.checks)).toBe(true);
      expect(draft.checks.length).toBeGreaterThan(0);
    }
  });

  it("flags recent medication changes in the draft", () => {
    // PT-10428 has a med started 10 days ago → schedule-changed warning present.
    const alvin = PATIENTS.find((p) => p.id === "PT-10428");
    const draft = suggestRepeatCycle(alvin);
    expect(draft.checks.some((c) => /changed recently/i.test(c.title))).toBe(true);
  });
});

describe("getTray — printable tray data", () => {
  it("exposes per-item appearance and instruction for the label", () => {
    const alvin = PATIENTS.find((p) => p.id === "PT-10428");
    const tray = getTray(alvin);
    const items = tray.flatMap((slot) => slot.items);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.instruction).toBeTruthy();
      expect(it.appearance).toBeTruthy();
      expect(it.appearance.colour).toBeTruthy();
    }
  });
});
