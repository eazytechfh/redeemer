import { Router } from "express";
import { z } from "zod";
import { allow, authenticate } from "./auth.js";
import { env } from "./config.js";
import { admin } from "./supabase.js";
import type { AuthedRequest } from "./types.js";

export const configurationRouter = Router();
configurationRouter.use(authenticate as never);

const stageKeys = [
  "novos_leads", "em_qualificacao", "transferido", "agendado",
  "orcamento_enviado", "follow_up", "matricula_feita", "pagou",
  "contrato_assinado", "analise",
] as const;
const lockedStageKeys = new Set(["novos_leads", "em_qualificacao", "transferido"]);

configurationRouter.get("/pipeline-stages", async (_req, res) => {
  const { data, error } = await admin.from("pipeline_stages").select("*").in("stable_key", stageKeys).order("position");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

configurationRouter.patch("/pipeline-stages/:id", allow("gestor", "admin", "admin_master") as never, async (req: any, res) => {
  const input = z.object({ name: z.string().min(2).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Nome ou cor inválidos." });
  const { data: stage } = await admin.from("pipeline_stages").select("*").eq("id", req.params.id).single();
  if (!stage) return res.status(404).json({ error: "Etapa não encontrada." });
  if (lockedStageKeys.has(stage.stable_key) && req.appUser.role !== "admin_master")
    return res.status(403).json({ error: "Esta etapa é protegida e somente o Admin Master pode editá-la." });
  const { data, error } = await admin.from("pipeline_stages").update(input.data).eq("id", stage.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

configurationRouter.delete("/pipeline-stages/:id", allow("gestor", "admin", "admin_master") as never, async (req: any, res) => {
  const { data: stage } = await admin.from("pipeline_stages").select("*").eq("id", req.params.id).single();
  if (!stage) return res.status(404).json({ error: "Etapa não encontrada." });
  if (lockedStageKeys.has(stage.stable_key) && req.appUser.role !== "admin_master")
    return res.status(403).json({ error: "Esta etapa é protegida e somente o Admin Master pode excluí-la." });
  const { error } = await admin.from("pipeline_stages").delete().eq("id", stage.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

configurationRouter.get("/queue", allow("gestor", "admin", "admin_master") as never, async (_req, res) => {
  const { data, error } = await admin.from("ATENDENTES").select("id,vendedor,telefone,atender,quantos_lead,ativo").in("atender", ["vez", "espera"]).order("id");
  if (error) return res.status(400).json({ error: error.message });
  res.json({ current: data.filter(x => x.atender === "vez"), waiting: data.filter(x => x.atender === "espera") });
});

configurationRouter.get("/credentials", allow("admin_master") as never, async (_req, res) => {
  const { data } = await admin.from("settings").select("value").eq("key", "uazapi").maybeSingle();
  res.json({
    supabaseUrl: mask(env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: mask(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    tokenConfigured: Boolean(data?.value?.token),
    whatsappStatus: data?.value?.status || "desconhecido",
  });
});

configurationRouter.put("/credentials/uazapi", allow("admin_master") as never, async (req: any, res) => {
  const parsed = z.object({ token: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Informe um token válido." });
  const { error } = await admin.from("settings").upsert({
    key: "uazapi", value: { token: parsed.data.token, status: "desconhecido" },
    updated_by: req.appUser.id, updated_at: new Date().toISOString(),
  });
  if (error) return res.status(400).json({ error: error.message });
  console.info(`[settings] Token UAZAPI atualizado por ${req.appUser.id}.`);
  res.json({ message: "Token salvo com segurança.", tokenConfigured: true });
});

configurationRouter.post("/credentials/whatsapp/connect", allow("admin_master") as never, async (req: any, res) => {
  const { data } = await admin.from("settings").select("value").eq("key", "uazapi").maybeSingle();
  if (!data?.value?.token) return res.status(400).json({ error: "Configure o token UAZAPI primeiro." });
  // A chamada é mantida no servidor para nunca expor o token no navegador.
  const response = await fetch(`${env.UAZAPI_BASE_URL}/instance/connect`, {
    method: "POST", headers: { "Content-Type": "application/json", token: data.value.token },
  });
  const payload = await response.json().catch(() => ({}));
  const status = response.ok ? "conectado" : "desconectado";
  await admin.from("settings").upsert({ key: "uazapi", value: { ...data.value, status }, updated_by: req.appUser.id, updated_at: new Date().toISOString() });
  if (!response.ok) return res.status(502).json({ error: payload.message || "A UAZAPI recusou a conexão." });
  res.json({ status, payload });
});

configurationRouter.get("/appearance", async (_req, res) => {
  const { data } = await admin.from("settings").select("key,value").in("key", ["appearance", "branding_logo"]);
  const map = Object.fromEntries((data || []).map(x => [x.key, x.value]));
  res.json({
    logoUrl: map.branding_logo?.url || null,
    colors: map.appearance || { primary: "#d92f38", secondary: "#f05259", text: "#20232b", background: "#f5f6f8" },
  });
});

configurationRouter.put("/appearance/colors", allow("admin_master") as never, async (req: any, res) => {
  const color = z.string().regex(/^#[0-9a-f]{6}$/i);
  const parsed = z.object({ primary: color, secondary: color, text: color, background: color }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Cores inválidas." });
  const { error } = await admin.from("settings").upsert({ key: "appearance", value: parsed.data, updated_by: req.appUser.id, updated_at: new Date().toISOString() });
  if (error) return res.status(400).json({ error: error.message });
  res.json(parsed.data);
});

configurationRouter.post("/appearance/logo", allow("admin_master") as never, async (req: any, res) => {
  const parsed = z.object({ data: z.string().min(20), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), extension: z.enum(["png", "jpg", "jpeg", "webp"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Imagem inválida. Use PNG, JPG ou WEBP." });
  const buffer = Buffer.from(parsed.data.data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (buffer.length > 5 * 1024 * 1024) return res.status(413).json({ error: "A imagem deve ter no máximo 5 MB." });
  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.some(x => x.name === "branding")) {
    const created = await admin.storage.createBucket("branding", { public: true, fileSizeLimit: 5242880, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (created.error) return res.status(400).json({ error: created.error.message });
  }
  const path = `logo.${parsed.data.extension}`;
  const uploaded = await admin.storage.from("branding").upload(path, buffer, { contentType: parsed.data.contentType, upsert: true });
  if (uploaded.error) return res.status(400).json({ error: uploaded.error.message });
  const { data: publicData } = admin.storage.from("branding").getPublicUrl(path);
  const url = `${publicData.publicUrl}?v=${Date.now()}`;
  const { error } = await admin.from("settings").upsert({ key: "branding_logo", value: { url }, updated_by: req.appUser.id, updated_at: new Date().toISOString() });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ logoUrl: url });
});

function mask(value: string) {
  if (value.length < 12) return "••••••••";
  return `${value.slice(0, 6)}${"•".repeat(10)}${value.slice(-5)}`;
}
