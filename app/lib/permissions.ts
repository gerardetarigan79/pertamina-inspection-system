export const ROLES = ["admin", "inspector", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "read_workspace",
  "write_inspections",
  "manage_users",
  "view_system_health",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Single role-to-permission map; keep all policy changes centralized here. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: PERMISSIONS,
  inspector: ["read_workspace", "write_inspections"],
  viewer: ["read_workspace"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function rolesForPermission(permission: Permission): Role[] {
  return ROLES.filter((role) => hasPermission(role, permission));
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
