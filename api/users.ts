import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resetPassword, usersIndex, userStatus } from "./_lib/users";
import { parameter } from "./_lib/core";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = (parameter(req.query.route) || "").replace(/^\/|\/$/g, "");
  if (!route) return usersIndex(req, res);

  const reset = route.match(/^([^/]+)\/reset-password$/);
  if (reset) {
    req.query.id = reset[1];
    return resetPassword(req, res);
  }

  const status = route.match(/^([^/]+)\/status$/);
  if (status) {
    req.query.id = status[1];
    return userStatus(req, res);
  }

  return res.status(404).json({ error: "Rota de usuários não encontrada." });
}

