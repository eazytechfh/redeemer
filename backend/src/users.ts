import { Router } from "express";
import { z } from "zod";
import { allow, authenticate } from "./auth.js";
import { admin } from "./supabase.js";
import type { AuthedRequest } from "./types.js";

export const usersRouter = Router();
usersRouter.use(authenticate as never);
usersRouter.use(allow("gestor", "admin", "admin_master") as never);

const createSchema = z.object({
  name: z.string().min(2), email: z.string().email(), password: z.string().min(8),
  phone: z.string().optional(), role: z.enum(["consultor", "gestor", "admin", "admin_master"]),
});

usersRouter.get("/", async (_req, res) => {
  const { data, error } = await admin.from("users").select("*").order("name");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

usersRouter.post("/", async (req: any, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revise os dados informados." });
  if (parsed.data.role === "admin_master" && req.appUser.role !== "admin_master")
    return res.status(403).json({ error: "Somente o Admin Master pode criar outro Admin Master." });
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email, password: parsed.data.password, email_confirm: true,
  });
  if (authError || !authData.user)
    return res.status(409).json({ error: authError?.message.includes("registered") ? "Este e-mail já está cadastrado." : "Não foi possível criar o acesso." });
  const { password: _, ...profile } = parsed.data;
  const { data, error } = await admin.from("users").insert({
    ...profile, phone: profile.phone || null, status: "ativo", auth_user_id: authData.user.id,
  }).select().single();
  if (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: "Não foi possível salvar o perfil. A criação foi revertida." });
  }

  let attendant = null;
  if (parsed.data.role === "consultor") {
    const { data: attendantData, error: attendantError } = await admin
      .from("ATENDENTES")
      .insert({
        vendedor: parsed.data.name,
        telefone: parsed.data.phone || null,
        atender: "espera",
        id_empresa: "1",
        ativo: true,
        quantos_lead: 0,
        id_click: null,
      })
      .select()
      .single();

    if (attendantError) {
      console.error(
        `[users:create] Falha ao criar ATENDENTES para auth_user_id=${authData.user.id}. Revertendo Auth e users.`,
        attendantError,
      );

      // Primeiro remove explicitamente o perfil. A remoção do usuário Auth também
      // funciona como segunda proteção por causa do FK users.auth_user_id ON DELETE CASCADE.
      const { error: profileRollbackError } = await admin
        .from("users")
        .delete()
        .eq("id", data.id);
      const { error: authRollbackError } =
        await admin.auth.admin.deleteUser(authData.user.id);

      if (profileRollbackError || authRollbackError) {
        console.error("[users:create] Rollback incompleto.", {
          profileRollbackError,
          authRollbackError,
        });
        return res.status(500).json({
          error:
            "Não foi possível criar o consultor e o rollback precisa de revisão administrativa.",
        });
      }

      return res.status(500).json({
        error:
          "Não foi possível vincular o consultor à fila de atendimento. A criação foi revertida.",
      });
    }

    attendant = attendantData;
    console.info(
      `[users:create] Consultor criado com sucesso: auth=${authData.user.id}, users=${data.id}, ATENDENTES=${attendantData.id}.`,
    );
  } else {
    console.info(
      `[users:create] Usuário ${data.id} criado com cargo ${parsed.data.role}; ATENDENTES não se aplica.`,
    );
  }

  res.status(201).json({ ...data, attendant });
});

usersRouter.post("/:id/reset-password", async (req: any, res) => {
  const password = z.string().min(8).safeParse(req.body.password);
  if (!password.success) return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
  const { data: target } = await admin.from("users").select("*").eq("id", req.params.id).single();
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
  const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password: password.data });
  if (error) return res.status(400).json({ error: "Não foi possível alterar a senha." });
  res.json({ message: "Senha provisória atualizada." });
});

usersRouter.patch("/:id/status", async (req: any, res) => {
  const status = z.enum(["ativo", "inativo"]).safeParse(req.body.status);
  if (!status.success) return res.status(400).json({ error: "Status inválido." });
  const { data: target } = await admin.from("users").select("*").eq("id", req.params.id).single();
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
  if (target.role === "admin_master") return res.status(403).json({ error: "O Admin Master não pode ser desativado." });
  const ban_duration = status.data === "inativo" ? "876000h" : "none";
  const { error: authError } = await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration });
  if (authError) return res.status(400).json({ error: "Não foi possível alterar o acesso." });
  const { data, error } = await admin.from("users").update({ status: status.data }).eq("id", target.id).select().single();
  if (error) {
    await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration: status.data === "inativo" ? "none" : "876000h" });
    return res.status(500).json({ error: "A alteração foi revertida." });
  }
  res.json(data);
});
