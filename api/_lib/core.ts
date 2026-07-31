import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const environment = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  UAZAPI_BASE_URL: z.string().url(),
}).parse(process.env);

export const env = environment;
export const admin = createClient(
  environment.NEXT_PUBLIC_SUPABASE_URL,
  environment.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export type Role = "consultor" | "gestor" | "admin" | "admin_master";
export type AppUser = {
  id: string; auth_user_id: string; name: string; email: string;
  phone: string | null; role: Role; status: "ativo" | "inativo";
};

export async function authorize(
  req: VercelRequest,
  res: VercelResponse,
  roles?: Role[],
): Promise<AppUser | null> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Sessão não informada." });
    return null;
  }
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
    return null;
  }
  const { data: profile } = await admin.from("users").select("*").eq("auth_user_id", user.id).single();
  if (!profile) {
    res.status(403).json({ error: "Perfil de acesso não encontrado." });
    return null;
  }
  if (profile.status !== "ativo") {
    res.status(403).json({ error: "Usuário desativado. Fale com um administrador." });
    return null;
  }
  if (roles && !roles.includes(profile.role)) {
    res.status(403).json({ error: "Você não tem permissão para esta ação." });
    return null;
  }
  return profile as AppUser;
}

export function method(req: VercelRequest, res: VercelResponse, allowed: string[]) {
  if (req.method && allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed);
  res.status(405).json({ error: "Método não permitido." });
  return false;
}

export function parameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function mask(value: string) {
  if (value.length < 12) return "••••••••";
  return `${value.slice(0, 6)}${"•".repeat(10)}${value.slice(-5)}`;
}

