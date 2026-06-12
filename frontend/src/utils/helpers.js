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
    return {
      action: "Quarantine",
      code: "STOP",
      label: "Expired",
      tone: "danger",
      daysRemaining,
    };
  }

  if (daysRemaining <= 30) {
    return {
      action: "Priority review",
      code: "REVIEW",
      label: "Within 1 month",
      tone: "warning",
      daysRemaining,
    };
  }

  if (daysRemaining <= 90) {
    return {
      action: "Monitor FEFO use",
      code: "MONITOR",
      label: "Within 3 months",
      tone: "blue",
      daysRemaining,
    };
  }

  return {
    action: "Available for allocation",
    code: "READY",
    label: "In date",
    tone: "success",
    daysRemaining,
  };
}

export function describeExpiry(daysRemaining) {
  if (daysRemaining < -1) {
    return `Expired ${Math.abs(daysRemaining)} days ago`;
  }

  if (daysRemaining === -1) {
    return "Expired yesterday";
  }

  if (daysRemaining === 0) {
    return "Expires today";
  }

  if (daysRemaining === 1) {
    return "Expires tomorrow";
  }

  return `Expires in ${daysRemaining} days`;
}

export function getQuantityStatus(quantity) {
  if (quantity === 0) {
    return { code: "STOP", label: "Out of stock", tone: "danger" };
  }

  if (quantity < 20) {
    return { code: "LOW", label: "Low stock", tone: "warning" };
  }

  return { code: "READY", label: "Available", tone: "success" };
}
