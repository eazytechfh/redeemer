import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
export const API = "/api";
export type Role = "consultor" | "gestor" | "admin" | "admin_master";
export type Profile = { id:string; name:string; email:string; phone?:string; role:Role; status:"ativo"|"inativo"; auth_user_id:string };
export const roleLabel: Record<Role,string> = { consultor:"Consultor", gestor:"Gestor", admin:"Admin", admin_master:"Admin Master" };
export async function api<T>(path:string, init?:RequestInit):Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${API}${path}`, { ...init, headers:{ "Content-Type":"application/json", Authorization:`Bearer ${data.session?.access_token}`, ...init?.headers }});
  const text = await response.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw new Error(response.ok ? "A API retornou uma resposta inválida." : text); }
  }
  if (!response.ok) throw new Error(body?.error || "Não foi possível concluir a solicitação.");
  return body as T;
}
