import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { admin, authorize, method, parameter } from "./core";

const managers = ["gestor", "admin", "admin_master"] as const;
const createSchema = z.object({
  name: z.string().min(2), email: z.string().email(), password: z.string().min(8),
  phone: z.string().optional(), role: z.enum(["consultor", "gestor", "admin", "admin_master"]),
});

export async function me(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  const user = await authorize(req, res);
  if (user) res.json(user);
}

export async function usersIndex(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET", "POST"])) return;
  const actor = await authorize(req, res, [...managers]);
  if (!actor) return;
  if (req.method === "GET") {
    const { data, error } = await admin.from("users").select("*").order("name");
    return error ? res.status(400).json({ error: error.message }) : res.json(data);
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revise os dados informados." });
  if (parsed.data.role === "admin_master" && actor.role !== "admin_master")
    return res.status(403).json({ error: "Somente o Admin Master pode criar outro Admin Master." });
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email, password: parsed.data.password, email_confirm: true,
  });
  if (authError || !authData.user)
    return res.status(409).json({ error: authError?.message.includes("registered") ? "Este e-mail já está cadastrado." : "Não foi possível criar o acesso." });
  const { password: _, ...profile } = parsed.data;
  const inserted = await admin.from("users").insert({
    ...profile, phone: profile.phone || null, status: "ativo", auth_user_id: authData.user.id,
  }).select().single();
  if (inserted.error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: "Não foi possível salvar o perfil. A criação foi revertida." });
  }
  let attendant = null;
  if (parsed.data.role === "consultor") {
    const created = await admin.from("ATENDENTES").insert({
      vendedor: parsed.data.name, telefone: parsed.data.phone || null, atender: "espera",
      id_empresa: "1", ativo: true, quantos_lead: 0, id_click: null,
    }).select().single();
    if (created.error) {
      const profileRollback = await admin.from("users").delete().eq("id", inserted.data.id);
      const authRollback = await admin.auth.admin.deleteUser(authData.user.id);
      console.error("[users:create] rollback", { profileRollback: profileRollback.error, authRollback: authRollback.error });
      return res.status(500).json({ error: "Não foi possível vincular o consultor à fila. A criação foi revertida." });
    }
    attendant = created.data;
    console.info(`[users:create] auth=${authData.user.id}, users=${inserted.data.id}, ATENDENTES=${attendant.id}`);
  }
  res.status(201).json({ ...inserted.data, attendant });
}

export async function resetPassword(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["POST"])) return;
  if (!await authorize(req, res, [...managers])) return;
  const password = z.string().min(8).safeParse(req.body?.password);
  if (!password.success) return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
  const { data: target } = await admin.from("users").select("*").eq("id", parameter(req.query.id)).single();
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
  const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password: password.data });
  return error ? res.status(400).json({ error: "Não foi possível alterar a senha." }) : res.json({ message: "Senha provisória atualizada." });
}

export async function userStatus(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PATCH"])) return;
  if (!await authorize(req, res, [...managers])) return;
  const status = z.enum(["ativo", "inativo"]).safeParse(req.body?.status);
  if (!status.success) return res.status(400).json({ error: "Status inválido." });
  const { data: target } = await admin.from("users").select("*").eq("id", parameter(req.query.id)).single();
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
  if (target.role === "admin_master") return res.status(403).json({ error: "O Admin Master não pode ser desativado." });
  const ban = status.data === "inativo" ? "876000h" : "none";
  const authUpdate = await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration: ban });
  if (authUpdate.error) return res.status(400).json({ error: "Não foi possível alterar o acesso." });
  const update = await admin.from("users").update({ status: status.data }).eq("id", target.id).select().single();
  if (update.error) {
    await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration: status.data === "inativo" ? "none" : "876000h" });
    return res.status(500).json({ error: "A alteração foi revertida." });
  }
  res.json(update.data);
}
