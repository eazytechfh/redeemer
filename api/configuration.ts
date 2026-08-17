import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  appearance, appearanceColors, appearanceLogo, credentials, pipelineStage,
  pipelineStages, queue, uazapi, whatsappConnect,
} from "./_lib/configuration";
import { parameter } from "./_lib/core";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = (parameter(req.query.route) || "").replace(/^\/|\/$/g, "");

  if (route === "pipeline-stages") return pipelineStages(req, res);
  if (route === "queue") return queue(req, res);
  if (route === "credentials") return credentials(req, res);
  if (route === "credentials/uazapi") return uazapi(req, res);
  if (route === "credentials/whatsapp/connect") return whatsappConnect(req, res);
  if (route === "appearance") return appearance(req, res);
  if (route === "appearance/colors") return appearanceColors(req, res);
  if (route === "appearance/logo") return appearanceLogo(req, res);

  const stage = route.match(/^pipeline-stages\/([^/]+)$/);
  if (stage) {
    req.query.id = stage[1];
    return pipelineStage(req, res);
  }

  return res.status(404).json({ error: "Rota de configuração não encontrada." });
}

