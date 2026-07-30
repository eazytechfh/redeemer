import type { Request } from "express";

export const roles = ["consultor", "gestor", "admin", "admin_master"] as const;
export type Role = (typeof roles)[number];
export type AppUser = {
  id: string; auth_user_id: string; name: string; email: string;
  phone: string | null; role: Role; status: "ativo" | "inativo";
};
export type AuthedRequest = Request & { appUser: AppUser };

