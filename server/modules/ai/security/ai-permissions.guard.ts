import type { Request, Response, NextFunction } from "express";
import { getAgent } from "../agents/agent-registry.ts";

interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string; roles?: string[] };
}

function getUserRoles(req: AuthenticatedRequest): string[] {
  if (!req.user) return [];
  if (req.user.roles) return req.user.roles;
  if (req.user.role) return [req.user.role];
  return [];
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    res.status(401).json({ error: "Autenticación requerida" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRoles = getUserRoles(req);
    if (!roles.some((r) => userRoles.includes(r))) {
      res.status(403).json({ error: `Rol requerido: ${roles.join(" o ")}` });
      return;
    }
    next();
  };
}

export function requireAgentAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const agentId = req.params.agentId ?? req.body?.agentId;
  if (!agentId) {
    res.status(400).json({ error: "agentId requerido" });
    return;
  }
  const agent = getAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: `Agente '${agentId}' no encontrado o deshabilitado` });
    return;
  }
  const userRoles = getUserRoles(req);
  if (!agent.allowedRoles.some((r) => userRoles.includes(r))) {
    res.status(403).json({ error: `Sin permiso para agente '${agentId}'` });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userRoles = getUserRoles(req);
  if (!userRoles.includes("admin")) {
    res.status(403).json({ error: "Se requiere rol admin" });
    return;
  }
  next();
}
