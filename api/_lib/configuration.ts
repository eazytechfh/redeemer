import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { admin, authorize, env, mask, method, parameter } from "./core";

const managers = ["gestor", "admin", "admin_master"] as const;
const stageKeys = ["novos_leads","em_qualificacao","transferido","agendado","orcamento_enviado","follow_up","matricula_feita","pagou","contrato_assinado","analise"];
const locked = new Set(["novos_leads", "em_qualificacao", "transferido"]);

export async function pipelineStages(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res)) return;
  const result = await admin.from("pipeline_stages").select("*").in("stable_key", stageKeys).order("position");
  return result.error ? res.status(400).json({ error: result.error.message }) : res.json(result.data);
}

export async function pipelineStage(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PATCH", "DELETE"])) return;
  const actor = await authorize(req, res, [...managers]);
  if (!actor) return;
  const { data: stage } = await admin.from("pipeline_stages").select("*").eq("id", parameter(req.query.id)).single();
  if (!stage) return res.status(404).json({ error: "Etapa não encontrada." });
  if (locked.has(stage.stable_key) && actor.role !== "admin_master")
    return res.status(403).json({ error: `Esta etapa é protegida e somente o Admin Master pode ${req.method === "DELETE" ? "excluí-la" : "editá-la"}.` });
  if (req.method === "DELETE") {
    const result = await admin.from("pipeline_stages").delete().eq("id", stage.id);
    return result.error ? res.status(400).json({ error: result.error.message }) : res.status(204).end();
  }
  const parsed = z.object({ name: z.string().min(2).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome ou cor inválidos." });
  const result = await admin.from("pipeline_stages").update(parsed.data).eq("id", stage.id).select().single();
  return result.error ? res.status(400).json({ error: result.error.message }) : res.json(result.data);
}

export async function queue(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res, [...managers])) return;
  const result = await admin.from("ATENDENTES").select("id,vendedor,telefone,atender,quantos_lead,ativo").in("atender", ["vez", "espera"]).order("id");
  if (result.error) return res.status(400).json({ error: result.error.message });
  res.json({ current: result.data.filter(x => x.atender === "vez"), waiting: result.data.filter(x => x.atender === "espera") });
}

export async function credentials(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res, ["admin_master"])) return;
  const { data } = await admin.from("settings").select("value").eq("key", "uazapi").maybeSingle();
  res.json({
    supabaseUrl: mask(env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: mask(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    tokenConfigured: Boolean(data?.value?.token),
    whatsappStatus: data?.value?.status || "desconhecido",
  });
}

export async function uazapi(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PUT"])) return;
  const actor = await authorize(req, res, ["admin_master"]);
  if (!actor) return;
  const parsed = z.object({ token: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Informe um token válido." });
  const result = await admin.from("settings").upsert({
    key: "uazapi", value: { token: parsed.data.token, status: "desconhecido" },
    updated_by: actor.id, updated_at: new Date().toISOString(),
  });
  if (result.error) return res.status(400).json({ error: result.error.message });
  console.info(`[settings] Token UAZAPI atualizado por ${actor.id}`);
  res.json({ message: "Token salvo com segurança.", tokenConfigured: true });
}

export async function whatsappConnect(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["POST"])) return;
  const actor = await authorize(req, res, ["admin_master"]);
  if (!actor) return;
  const { data } = await admin.from("settings").select("value").eq("key", "uazapi").maybeSingle();
  if (!data?.value?.token) return res.status(400).json({ error: "Configure o token UAZAPI primeiro." });
  const response = await fetch(`${env.UAZAPI_BASE_URL}/instance/connect`, {
    method: "POST", headers: { "Content-Type": "application/json", token: data.value.token },
  });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  const status = response.ok ? "conectado" : "desconectado";
  await admin.from("settings").upsert({ key: "uazapi", value: { ...data.value, status }, updated_by: actor.id, updated_at: new Date().toISOString() });
  return response.ok ? res.json({ status, payload }) : res.status(502).json({ error: payload.message || "A UAZAPI recusou a conexão." });
}

export async function appearance(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res)) return;
  const { data } = await admin.from("settings").select("key,value").in("key", ["appearance", "branding_logo"]);
  const map = Object.fromEntries((data || []).map(x => [x.key, x.value]));
  res.json({
    logoUrl: map.branding_logo?.url || null,
    colors: map.appearance || { primary: "#d92f38", secondary: "#f05259", text: "#20232b", background: "#f5f6f8" },
  });
}

export async function appearanceColors(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PUT"])) return;
  const actor = await authorize(req, res, ["admin_master"]);
  if (!actor) return;
  const color = z.string().regex(/^#[0-9a-f]{6}$/i);
  const parsed = z.object({ primary: color, secondary: color, text: color, background: color }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Cores inválidas." });
  const result = await admin.from("settings").upsert({ key: "appearance", value: parsed.data, updated_by: actor.id, updated_at: new Date().toISOString() });
  return result.error ? res.status(400).json({ error: result.error.message }) : res.json(parsed.data);
}

export async function appearanceLogo(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["POST"])) return;
  const actor = await authorize(req, res, ["admin_master"]);
  if (!actor) return;
  const parsed = z.object({
    data: z.string().min(20), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    extension: z.enum(["png", "jpg", "jpeg", "webp"]),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Imagem inválida. Use PNG, JPG ou WEBP." });
  const buffer = Buffer.from(parsed.data.data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (buffer.length > 4.5 * 1024 * 1024) return res.status(413).json({ error: "A imagem deve ter no máximo 4,5 MB." });
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
  const result = await admin.from("settings").upsert({ key: "branding_logo", value: { url }, updated_by: actor.id, updated_at: new Date().toISOString() });
  return result.error ? res.status(400).json({ error: result.error.message }) : res.json({ logoUrl: url });
}
