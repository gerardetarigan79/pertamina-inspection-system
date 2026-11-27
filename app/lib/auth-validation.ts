import { isRole, type Role } from "./permissions";

export type LoginInput = { email: string; password: string };

export function parseLoginInput(value: unknown): LoginInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.email !== "string" || typeof body.password !== "string") return null;

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  if (body.password.length < 1 || Buffer.byteLength(body.password, "utf8") > 72) return null;
  return { email, password: body.password };
}

export type CreateUserInput = {
  name: string;
  email: string;
  role: Role;
  temporaryPassword: string;
  mustChangePassword: boolean;
};

export function parseCreateUserInput(value: unknown): CreateUserInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.role !== "string" ||
    typeof body.temporaryPassword !== "string"
  ) return null;

  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();
  const temporaryPassword = body.temporaryPassword;
  if (name.length < 2 || name.length > 120) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  if (!isRole(body.role)) return null;
  if (temporaryPassword.length < 12 || Buffer.byteLength(temporaryPassword, "utf8") > 72) return null;
  if (body.mustChangePassword !== undefined && typeof body.mustChangePassword !== "boolean") return null;

  return {
    name, email, role: body.role, temporaryPassword,
    mustChangePassword: body.mustChangePassword !== false,
  };
}

export type UpdateUserInput = { role?: Role; isActive?: boolean };

export function parseUpdateUserInput(value: unknown): UpdateUserInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const hasRole = Object.hasOwn(body, "role");
  const hasActive = Object.hasOwn(body, "isActive");
  if (!hasRole && !hasActive) return null;
  if (hasRole && !isRole(body.role)) return null;
  if (hasActive && typeof body.isActive !== "boolean") return null;
  return {
    ...(hasRole ? { role: body.role as Role } : {}),
    ...(hasActive ? { isActive: body.isActive as boolean } : {}),
  };
}

export function isValidNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 72;
}
