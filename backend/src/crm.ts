import { Router } from "express";
import { z } from "zod";
import { authenticate } from "./auth.js";
import { admin } from "./supabase.js";

export const crmRouter = Router();
crmRouter.use(authenticate as never);

const stageKeys = ["novos_leads","em_qualificacao","transferido","agendado","orcamento_enviado","follow_up","matricula_feita","pagou","contrato_assinado","analise"] as const;

crmRouter.get("/clients", async (req, res) => {
  const zone = z.enum(["Zona Cinza", "Zona Verde"]).safeParse(req.query.zone);
  if (!zone.success) return res.status(400).json({ error: "Zona inválida." });
  const { data, error } = await admin.from("Clientes").select("*").eq("ZONA", zone.data).order("created_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  const ids = (data || []).map(x => x.id);
  const links = ids.length
    ? await admin.from("clientes_tags").select("cliente_id,tag:tags(id,name,color)").in("cliente_id", ids)
    : { data: [], error: null };
  // A migration pode ainda não ter sido aplicada; o board continua disponível sem badges.
  if (links.error && links.error.code !== "PGRST205") return res.status(400).json({ error: links.error.message });
  const byClient = new Map<number, unknown[]>();
  for (const link of (links.data || []) as any[]) {
    byClient.set(link.cliente_id, [...(byClient.get(link.cliente_id) || []), link.tag]);
  }
  res.json((data || []).map(client => ({ ...client, tags: byClient.get(client.id) || [] })));
});

crmRouter.patch("/clients/:id/stage", async (req: any, res) => {
  const stage = z.enum(stageKeys).safeParse(req.body.stage);
  if (!stage.success) return res.status(400).json({ error: "Etapa inválida." });
  const { data, error } = await admin.from("Clientes").update({ estagio_lead: stage.data }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  console.info(`[pipeline] Cliente ${req.params.id} movido para ${stage.data} por ${req.appUser.id}.`);
  res.json(data);
});

crmRouter.get("/tags", async (_req, res) => {
  const { data, error } = await admin.from("tags").select("*").order("name");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
crmRouter.post("/tags", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-f]{6}$/i) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome ou cor inválidos." });
  const { data, error } = await admin.from("tags").insert(parsed.data).select().single();
  if (error) return res.status(400).json({ error: error.code === "23505" ? "Já existe uma etiqueta com esse nome." : error.message });
  res.status(201).json(data);
});
crmRouter.delete("/tags/:id", async (req, res) => {
  const { error } = await admin.from("tags").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});
crmRouter.get("/clients/:id/tags", async (req, res) => {
  const { data, error } = await admin.from("clientes_tags").select("id,tag:tags(id,name,color)").eq("cliente_id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json((data || []).map((x: any) => x.tag));
});
crmRouter.post("/clients/:id/tags/:tagId", async (req, res) => {
  const { data, error } = await admin.from("clientes_tags").upsert({ cliente_id: Number(req.params.id), tag_id: req.params.tagId }, { onConflict: "cliente_id,tag_id" }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});
crmRouter.delete("/clients/:id/tags/:tagId", async (req, res) => {
  const { error } = await admin.from("clientes_tags").delete().eq("cliente_id", req.params.id).eq("tag_id", req.params.tagId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});
