// Mirrors the backend AuditAction enum.
export const AUDIT_ACTION_OPTIONS = [
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "LOGIN_FAILED", label: "Login failed" },
  { value: "USER_CREATED", label: "User created" },
  { value: "USER_DEACTIVATED", label: "User deactivated" },
  { value: "USER_DELETED", label: "User deleted" },
  { value: "PASSWORD_CHANGED", label: "Password changed" },
  { value: "PASSWORD_RESET", label: "Password reset" },
  { value: "ROLE_ASSIGNED", label: "Role assigned" },
  { value: "GROUP_CREATED", label: "Group created" },
  { value: "GROUP_UPDATED", label: "Group updated" },
  { value: "PHARMACY_CREATED", label: "Pharmacy created" },
  { value: "PHARMACY_UPDATED", label: "Pharmacy updated" },
] as const;
