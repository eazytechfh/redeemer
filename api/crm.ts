import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientStage, clientTag, clientTags, clients, tagById, tags } from "./_lib/crm";
import { parameter } from "./_lib/core";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = (parameter(req.query.route) || "").replace(/^\/|\/$/g, "");
  if (route === "clients") return clients(req, res);
  if (route === "tags") return tags(req, res);

  const stage = route.match(/^clients\/([^/]+)\/stage$/);
  if (stage) {
    req.query.id = stage[1];
    return clientStage(req, res);
  }

  const clientTagRoute = route.match(/^clients\/([^/]+)\/tags\/([^/]+)$/);
  if (clientTagRoute) {
    req.query.id = clientTagRoute[1];
    req.query.tagId = clientTagRoute[2];
    return clientTag(req, res);
  }

  const clientTagsRoute = route.match(/^clients\/([^/]+)\/tags$/);
  if (clientTagsRoute) {
    req.query.id = clientTagsRoute[1];
    return clientTags(req, res);
  }

  const tag = route.match(/^tags\/([^/]+)$/);
  if (tag) {
    req.query.id = tag[1];
    return tagById(req, res);
  }

  return res.status(404).json({ error: "Rota do CRM não encontrada." });
}

