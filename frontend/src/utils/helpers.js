export function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "PT";
}

export function getExpiryStatus(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  const daysRemaining = Math.round((expiry - today) / 86400000);

  if (daysRemaining < 0) {
    return { label: "Expired", tone: "danger", daysRemaining };
  }

  if (daysRemaining <= 30) {
    return { label: "Within 1 month", tone: "warning", daysRemaining };
  }

  if (daysRemaining <= 90) {
    return { label: "Within 3 months", tone: "blue", daysRemaining };
  }

  return { label: "In date", tone: "success", daysRemaining };
}

export function getQuantityStatus(quantity) {
  if (quantity === 0) {
    return { label: "Out of stock", tone: "danger" };
  }

  if (quantity < 20) {
    return { label: "Low stock", tone: "warning" };
  }

  return { label: "Available", tone: "success" };
}
