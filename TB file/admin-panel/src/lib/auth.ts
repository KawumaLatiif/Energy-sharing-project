export type AdminRole = "CUSTOMER_SERVICE" | "OPERATOR" | "ADMIN";

export function getAdminRole(): AdminRole | null {
  return (localStorage.getItem("gpawa_admin_role") as AdminRole) || null;
}

export function getAdminToken(): string | null {
  return localStorage.getItem("gpawa_admin_token");
}

export function setAdminSession(token: string, role: AdminRole) {
  localStorage.setItem("gpawa_admin_token", token);
  localStorage.setItem("gpawa_admin_role", role);
}

export function clearAdminSession() {
  localStorage.removeItem("gpawa_admin_token");
  localStorage.removeItem("gpawa_admin_role");
}

export function hasPermission(role: AdminRole | null, required: AdminRole[]): boolean {
  if (!role) return false;
  const levels: Record<AdminRole, number> = {
    CUSTOMER_SERVICE: 1,
    OPERATOR: 2,
    ADMIN: 3,
  };
  return required.some(r => levels[role] >= levels[r]);
}
