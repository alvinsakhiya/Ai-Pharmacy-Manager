export const gbp = (n) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number(n || 0)
  );

export const num = (n) => new Intl.NumberFormat("en-GB").format(Number(n || 0));

export const dateFmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateTimeFmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// FEFO heat band -> token + label, aligned with the design system expiry scale.
export function expiryBand(days) {
  if (days < 0) return { key: "expired", label: "Expired", color: "#E0402F", text: "#B42318", bg: "#FDECEA" };
  if (days <= 30) return { key: "le30", label: "≤ 30 days", color: "#E8A100", text: "#9A6A00", bg: "#FFF6E0" };
  if (days <= 90) return { key: "le90", label: "31–90 days", color: "#C9A227", text: "#7a6210", bg: "#FBF4DC" };
  if (days <= 180) return { key: "le180", label: "91–180 days", color: "#7BA05B", text: "#4e6b39", bg: "#EEF4E7" };
  return { key: "fresh", label: "> 180 days", color: "#9099A4", text: "#5B6470", bg: "#F0F2F5" };
}
