export const FALLBACK_DIRECTIONS = [
  { code: "ONE", text: "Take one", category: "dose", category_display: "Dose" },
  { code: "TWO", text: "Take two", category: "dose", category_display: "Dose" },
  { code: "1TAB", text: "Take one tablet", category: "dose", category_display: "Dose" },
  { code: "2TAB", text: "Take two tablets", category: "dose", category_display: "Dose" },
  { code: "1CAP", text: "Take one capsule", category: "dose", category_display: "Dose" },
  { code: "OD", text: "Once daily", category: "timing", category_display: "Timing" },
  { code: "BD", text: "Twice daily", category: "timing", category_display: "Timing" },
  { code: "TDS", text: "Three times daily", category: "timing", category_display: "Timing" },
  { code: "QDS", text: "Four times daily", category: "timing", category_display: "Timing" },
  { code: "AM", text: "In the morning", category: "timing", category_display: "Timing" },
  { code: "PM", text: "In the evening", category: "timing", category_display: "Timing" },
  { code: "ON", text: "At bedtime", category: "timing", category_display: "Timing" },
  { code: "PRN", text: "When required", category: "qualifier", category_display: "Qualifier" },
  { code: "WF", text: "With food", category: "qualifier", category_display: "Qualifier" },
  { code: "BF", text: "Before food", category: "qualifier", category_display: "Qualifier" },
  { code: "AF", text: "After food", category: "qualifier", category_display: "Qualifier" },
  { code: "EXT", text: "For external use only", category: "qualifier", category_display: "Qualifier" },
  { code: "SHAKE", text: "Shake well before use", category: "qualifier", category_display: "Qualifier" },
  { code: "L-EYE", text: "Into the left eye", category: "route", category_display: "Route" },
  { code: "R-EYE", text: "Into the right eye", category: "route", category_display: "Route" },
  { code: "INHALE2", text: "Inhale two puffs", category: "route", category_display: "Route" },
  { code: "SKIN", text: "Apply thinly to the affected area", category: "route", category_display: "Route" },
];

export function filterDirections(rows, query) {
  const q = query.trim().toLowerCase();
  if (!q) return rows.slice(0, 100);
  return rows
    .filter((row) => row.code.toLowerCase().includes(q) || row.text.toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (row) => {
        if (row.code.toLowerCase() === q) return 0;
        if (row.code.toLowerCase().startsWith(q)) return 1;
        if (row.text.toLowerCase().startsWith(q)) return 2;
        return 3;
      };
      return rank(a) - rank(b) || a.code.localeCompare(b.code);
    });
}

export function appendDirection(current, phrase) {
  const base = current.trim().replace(/[.;,\s]+$/, "");
  const addition = phrase.trim();
  if (!base) return addition;
  if (!addition) return base;
  return `${base}; ${addition.charAt(0).toLowerCase()}${addition.slice(1)}`;
}
