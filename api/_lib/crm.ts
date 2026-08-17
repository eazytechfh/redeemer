import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { admin, authorize, method, parameter, type AppUser } from "./core";

const stageKeys = ["novos_leads","em_qualificacao","transferido","agendado","orcamento_enviado","follow_up","matricula_feita","pagou","contrato_assinado","analise"] as const;
const automatedStageKeys = ["agendado","orcamento_enviado","follow_up","matricula_feita","pagou","contrato_assinado","analise"] as const;
const tagInput = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  linked_stage: z.enum(automatedStageKeys).nullable().optional(),
});
const clientCreateInput = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().max(200).nullable().optional(),
  zone: z.enum(["Zona Cinza", "Zona Verde"]),
  consultant_id: z.string().uuid().nullable().optional(),
  course_interest: z.string().trim().max(200).nullable().optional(),
  stage: z.enum(stageKeys),
});
const clientUpdateInput = z.object({
  cpf: z.string().trim().max(20).nullable().optional(),
  birth_date: z.string().date().nullable().optional(),
  source: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  negotiation: z.object({
    course_interest: z.string().trim().max(200).nullable(),
    amount: z.number().nonnegative().nullable(),
    consultant_id: z.string().uuid().nullable(),
  }).optional(),
});

const schemaPending = (error: { code?: string } | null) =>
  !!error && ["42703", "PGRST204", "PGRST205"].includes(error.code || "");

async function audit(
  cliente_id: number,
  user_id: string,
  changes: { field: string; oldValue: unknown; newValue: unknown; action?: string }[],
) {
  const rows = changes
    .filter(change => change.oldValue !== change.newValue)
    .map(change => ({
      cliente_id,
      user_id,
      action: change.action || "field_updated",
      field: change.field,
      old_value: change.oldValue,
      new_value: change.newValue,
    }));
  if (!rows.length) return null;
  const result = await admin.from("logs").insert(rows);
  return result.error;
}

export async function clients(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET", "POST"])) return;
  const actor = await authorize(req, res);
  if (!actor) return;
  if (req.method === "POST") return createClient(req, res, actor);

  const zoneParam = parameter(req.query.zone);
  const zone = zoneParam ? z.enum(["Zona Cinza", "Zona Verde"]).safeParse(zoneParam) : null;
  if (zone && !zone.success) return res.status(400).json({ error: "Zona inválida." });

  const tagId = parameter(req.query.tagId);
  let clientIds: number[] | null = null;
  if (tagId) {
    const tagLinks = await admin.from("clientes_tags").select("cliente_id").eq("tag_id", tagId);
    if (tagLinks.error) return res.status(400).json({ error: tagLinks.error.message });
    clientIds = (tagLinks.data || []).map(x => x.cliente_id);
    if (!clientIds.length) return res.json([]);
  }

  let query = admin.from("Clientes").select("*").order("created_at", { ascending: false });
  if (zone) query = query.eq("ZONA", zone.data);
  if (clientIds) query = query.in("id", clientIds);
  const result = await query;
  if (result.error) return res.status(400).json({ error: result.error.message });

  const ids = (result.data || []).map(x => x.id);
  const [links, negotiations] = await Promise.all([
    ids.length ? admin.from("clientes_tags").select("cliente_id,tag:tags(id,name,color)").in("cliente_id", ids) : Promise.resolve({ data: [] as any[], error: null as any }),
    ids.length ? admin.from("negotiations").select("cliente_id,course_interest,amount,consultant_id,consultant:users(name)").in("cliente_id", ids) : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);
  if (links.error && links.error.code !== "PGRST205") return res.status(400).json({ error: links.error.message });
  if (negotiations.error && !schemaPending(negotiations.error)) return res.status(400).json({ error: negotiations.error.message });

  const tagsByClient = new Map<number, unknown[]>();
  for (const link of (links.data || []) as any[]) tagsByClient.set(link.cliente_id, [...(tagsByClient.get(link.cliente_id) || []), link.tag]);
  const negotiationByClient = new Map<number, any>();
  for (const negotiation of (negotiations.data || []) as any[]) negotiationByClient.set(negotiation.cliente_id, negotiation);

  res.json((result.data || []).map(client => {
    const negotiation = negotiationByClient.get(client.id);
    return {
      ...client,
      tags: tagsByClient.get(client.id) || [],
      course_interest: negotiation?.course_interest ?? null,
      amount: negotiation?.amount ?? null,
      consultant_id: negotiation?.consultant_id ?? null,
      consultant_name: negotiation?.consultant?.name ?? null,
    };
  }));
}

async function createClient(req: VercelRequest, res: VercelResponse, actor: AppUser) {
  const parsed = clientCreateInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revise os dados do lead." });
  const { name, phone, email, zone, consultant_id, course_interest, stage } = parsed.data;

  const basePayload: Record<string, unknown> = {
    "nome do cliente": name,
    "Numero do cliente": phone,
    ZONA: zone,
    estagio_lead: stage,
  };

  let inserted = await admin.from("Clientes").insert({ ...basePayload, email: email || null }).select().single();
  if (inserted.error && schemaPending(inserted.error)) {
    inserted = await admin.from("Clientes").insert(basePayload).select().single();
  }
  if (inserted.error) return res.status(400).json({ error: inserted.error.message });

  if (course_interest || consultant_id) {
    const negotiationInsert = await admin.from("negotiations").insert({
      cliente_id: inserted.data.id,
      course_interest: course_interest || null,
      consultant_id: consultant_id || null,
      status: "ativa",
    });
    if (negotiationInsert.error) console.error("[crm:create-client:negotiation]", negotiationInsert.error);
  }

  console.info(`[crm] Lead ${inserted.data.id} criado por ${actor.id}`);
  return res.status(201).json(inserted.data);
}

export async function clientStage(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PATCH"])) return;
  const actor = await authorize(req, res);
  if (!actor) return;
  const stage = z.enum(stageKeys).safeParse(req.body?.stage);
  if (!stage.success) return res.status(400).json({ error: "Etapa inválida." });
  const id = parameter(req.query.id);
  const current = await admin.from("Clientes").select("id,estagio_lead").eq("id", id).single();
  if (current.error) return res.status(404).json({ error: "Candidato não encontrado." });
  const result = await admin.from("Clientes").update({ estagio_lead: stage.data }).eq("id", id).select().single();
  if (result.error) return res.status(400).json({ error: result.error.message });
  const auditError = await audit(Number(id), actor.id, [{
    field: "estagio_lead",
    oldValue: current.data.estagio_lead,
    newValue: stage.data,
    action: "stage_changed",
  }]);
  if (auditError) console.error("[pipeline:audit]", auditError);
  console.info(`[pipeline] Cliente ${id} movido para ${stage.data} por ${actor.id}`);
  res.json(result.data);
}

export async function consultants(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET"])) return;
  if (!await authorize(req, res)) return;
  const result = await admin.from("users").select("id,name").eq("role", "consultor").eq("status", "ativo").order("name");
  return result.error ? res.status(400).json({ error: result.error.message }) : res.json(result.data || []);
}

export async function clientDetails(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET", "PATCH", "DELETE"])) return;
  const actor = await authorize(req, res);
  if (!actor) return;
  const clienteId = Number(parameter(req.query.id));
  if (!Number.isSafeInteger(clienteId)) return res.status(400).json({ error: "Candidato inválido." });

  if (req.method === "DELETE") {
    const result = await admin.from("Clientes").delete().eq("id", clienteId).select("id").maybeSingle();
    if (result.error) return res.status(400).json({ error: result.error.message });
    return result.data ? res.status(204).end() : res.status(404).json({ error: "Candidato não encontrado." });
  }

  const clientResult = await admin.from("Clientes").select("*").eq("id", clienteId).single();
  if (clientResult.error) return res.status(404).json({ error: "Candidato não encontrado." });

  if (req.method === "GET") {
    const [negotiationResult, logsResult] = await Promise.all([
      admin.from("negotiations").select("*").eq("cliente_id", clienteId).maybeSingle(),
      admin.from("logs").select("*,user:users(name)").eq("cliente_id", clienteId).order("created_at", { ascending: false }),
    ]);
    if (negotiationResult.error && !schemaPending(negotiationResult.error))
      return res.status(400).json({ error: negotiationResult.error.message });
    if (logsResult.error && !schemaPending(logsResult.error))
      return res.status(400).json({ error: logsResult.error.message });
    return res.json({
      client: clientResult.data,
      negotiation: negotiationResult.error ? null : negotiationResult.data,
      logs: logsResult.error ? [] : logsResult.data || [],
      schemaPending: schemaPending(negotiationResult.error) || schemaPending(logsResult.error),
    });
  }

  const parsed = clientUpdateInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revise os dados do candidato." });
  const { negotiation, ...clientChanges } = parsed.data;
  const normalizedClientChanges = Object.fromEntries(
    Object.entries(clientChanges).map(([key, value]) => [key, value === "" ? null : value]),
  );
  const clientAudit = Object.entries(normalizedClientChanges).map(([field, newValue]) => ({
    field,
    oldValue: clientResult.data[field],
    newValue,
  }));
  if (Object.keys(normalizedClientChanges).length) {
    const update = await admin.from("Clientes").update(normalizedClientChanges).eq("id", clienteId).select().single();
    if (update.error) return res.status(400).json({ error: update.error.message });
  }

  const negotiationAudit: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (negotiation) {
    const currentNegotiation = await admin.from("negotiations").select("*").eq("cliente_id", clienteId).maybeSingle();
    if (currentNegotiation.error) return res.status(400).json({ error: currentNegotiation.error.message });
    for (const [field, newValue] of Object.entries(negotiation)) {
      negotiationAudit.push({ field, oldValue: currentNegotiation.data?.[field] ?? null, newValue });
    }
    const values = { ...negotiation, cliente_id: clienteId, status: currentNegotiation.data?.status || "ativa" };
    const saved = currentNegotiation.data
      ? await admin.from("negotiations").update(values).eq("id", currentNegotiation.data.id)
      : await admin.from("negotiations").insert(values);
    if (saved.error) return res.status(400).json({ error: saved.error.message });
  }

  const auditError = await audit(clienteId, actor.id, [...clientAudit, ...negotiationAudit]);
  if (auditError) return res.status(500).json({ error: "Os dados foram salvos, mas não foi possível registrar o histórico." });
  return res.json({ message: "Dados do candidato atualizados." });
}

export async function tags(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["GET", "POST"])) return;
  if (!await authorize(req, res)) return;
  if (req.method === "GET") {
    const result = await admin.from("tags").select("*").order("name");
    return result.error ? res.status(400).json({ error: result.error.message }) : res.json(result.data);
  }
  const parsed = tagInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome, cor ou etapa inválidos." });
  const result = await admin.from("tags").insert(parsed.data).select().single();
  return result.error
    ? res.status(400).json({ error: result.error.code === "23505" ? "Nome ou etapa já vinculados a outra etiqueta." : result.error.message })
    : res.status(201).json(result.data);
}

export async function tagById(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, ["PATCH", "DELETE"])) return;
  if (!await authorize(req, res)) return;
  const id = parameter(req.query.id);
  if (req.method === "DELETE") {
    const result = await admin.from("tags").delete().eq("id", id);
    return result.error ? res.status(400).json({ error: result.error.message }) : res.status(204).end();
  }
  const parsed = tagInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome, cor ou etapa inválidos." });
  const result = await admin.from("tags").update(parsed.data).eq("id", id).select().single();
  return result.error
    ? res.status(400).json({ error: result.error.code === "23505" ? "Nome ou etapa já vinculados a outra etiqueta." : result.error.message })
    : res.json(result.data);
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
