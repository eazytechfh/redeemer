import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { admin, authorize, method, parameter } from "./core";

const stageKeys = ["novos_leads","em_qualificacao","transferido","agendado","orcamento_enviado","follow_up","matricula_feita","pagou","contrato_assinado","analise"] as const;

export async function clients(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res)) return;
  const zone = z.enum(["Zona Cinza", "Zona Verde"]).safeParse(parameter(req.query.zone));
  if (!zone.success) return res.status(400).json({ error: "Zona inválida." });
  const result = await admin.from("Clientes").select("*").eq("ZONA", zone.data).order("created_at", { ascending: false });
  if (result.error) return res.status(400).json({ error: result.error.message });
  const ids = (result.data || []).map(x => x.id);
  const links = ids.length ? await admin.from("clientes_tags").select("cliente_id,tag:tags(id,name,color)").in("cliente_id", ids) : { data: [], error: null };
  if (links.error && links.error.code !== "PGRST205") return res.status(400).json({ error: links.error.message });
  const byClient = new Map<number, unknown[]>();
  for (const link of (links.data || []) as any[]) byClient.set(link.cliente_id, [...(byClient.get(link.cliente_id) || []), link.tag]);
  res.json((result.data || []).map(client => ({ ...client, tags: byClient.get(client.id) || [] })));
}

export async function clientStage(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PATCH"])) return;
  const actor = await authorize(req, res);
  if (!actor) return;
  const stage = z.enum(stageKeys).safeParse(req.body?.stage);
  if (!stage.success) return res.status(400).json({ error: "Etapa inválida." });
  const id = parameter(req.query.id);
  const result = await admin.from("Clientes").update({ estagio_lead: stage.data }).eq("id", id).select().single();
  if (result.error) return res.status(400).json({ error: result.error.message });
  console.info(`[pipeline] Cliente ${id} movido para ${stage.data} por ${actor.id}`);
  res.json(result.data);
}

export async function tags(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET", "POST"])) return;
  if (!await authorize(req, res)) return;
  if (req.method === "GET") {
    const result = await admin.from("tags").select("*").order("name");
    return result.error ? res.status(400).json({ error: result.error.message }) : res.json(result.data);
  }
  const parsed = z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-f]{6}$/i) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome ou cor inválidos." });
  const result = await admin.from("tags").insert(parsed.data).select().single();
  return result.error
    ? res.status(400).json({ error: result.error.code === "23505" ? "Já existe uma etiqueta com esse nome." : result.error.message })
    : res.status(201).json(result.data);
}

export async function tagById(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["DELETE"])) return;
  if (!await authorize(req, res)) return;
  const result = await admin.from("tags").delete().eq("id", parameter(req.query.id));
  return result.error ? res.status(400).json({ error: result.error.message }) : res.status(204).end();
}

export async function clientTags(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res)) return;
  const result = await admin.from("clientes_tags").select("id,tag:tags(id,name,color)").eq("cliente_id", parameter(req.query.id));
  if (result.error) return res.status(400).json({ error: result.error.message });
  res.json((result.data || []).map((x: any) => x.tag));
}

export async function clientTag(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["POST", "DELETE"])) return;
  if (!await authorize(req, res)) return;
  const cliente_id = Number(parameter(req.query.id));
  const tag_id = parameter(req.query.tagId);
  if (req.method === "POST") {
    const result = await admin.from("clientes_tags").upsert({ cliente_id, tag_id }, { onConflict: "cliente_id,tag_id" }).select().single();
    return result.error ? res.status(400).json({ error: result.error.message }) : res.status(201).json(result.data);
  }
  const result = await admin.from("clientes_tags").delete().eq("cliente_id", cliente_id).eq("tag_id", tag_id);
  return result.error ? res.status(400).json({ error: result.error.message }) : res.status(204).end();
}
