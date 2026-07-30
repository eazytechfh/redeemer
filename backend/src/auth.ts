import type { NextFunction, Response } from "express";
import { admin } from "./supabase.js";
import type { AuthedRequest, Role } from "./types.js";

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sessão não informada." });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Sessão inválida ou expirada." });
  const { data: profile } = await admin.from("users").select("*").eq("auth_user_id", user.id).single();
  if (!profile) return res.status(403).json({ error: "Perfil de acesso não encontrado." });
  if (profile.status !== "ativo") return res.status(403).json({ error: "Usuário desativado. Fale com um administrador." });
  req.appUser = profile;
  next();
}

export const allow = (...allowed: Role[]) =>
  (req: AuthedRequest, res: Response, next: NextFunction) =>
    allowed.includes(req.appUser.role) ? next() : res.status(403).json({ error: "Você não tem permissão para esta ação." });

