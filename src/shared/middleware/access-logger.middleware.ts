import { Request, Response, NextFunction } from "express";
import { logger } from "@/shared/utils/logger.utils";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware para registro de acesso às rotas da API
 * Gera um ID único para cada requisição e registra tempo de resposta
 */
export const accessLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Adiciona um ID único para a requisição
  const requestId = uuidv4();
  req.requestId = requestId;

  // Registra o horário de início da requisição
  const startTime = process.hrtime();

  // Captura o IP de origem
  const ip =
    (req.headers["x-forwarded-for"] as string) ||
    req.socket.remoteAddress ||
    "unknown";

  // Intercepta o método end para registrar o log quando a resposta for enviada
  const originalEnd = res.end;

  // @ts-ignore - Sobrescreve o método end
  res.end = function (chunk?: any, encoding?: any): Response {
    // Calcula o tempo de resposta
    const hrTime = process.hrtime(startTime);
    const responseTime = Math.round(hrTime[0] * 1000 + hrTime[1] / 1000000);

    // Obtém o usuário se autenticado
    const userId = req.user?.id;

    // Registra o acesso
    logger.access(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      responseTime,
      req.headers["user-agent"],
      ip,
      userId
    );

    // Chama o método original
    // @ts-ignore
    return originalEnd.apply(this, arguments);
  };

  next();
};

// Adiciona o tipo requestId ao Request do Express
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
