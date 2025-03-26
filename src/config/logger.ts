import morgan from "morgan";
import { Request, Response, NextFunction } from "express";
import { env } from "./environment";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Configuração personalizada do Morgan para logging de requisições HTTP
 */
export const morganMiddleware = () => {
  // Formato personalizado que inclui tempo de resposta
  const format =
    ":method :url :status :res[content-length] - :response-time ms";

  // Stream personalizado que direciona os logs para nosso logger
  const stream = {
    write: (message: string) => {
      // Remove a quebra de linha que o Morgan adiciona
      const trimmedMessage = message.trim();

      // Não usamos diretamente o Morgan para logs detalhados
      // Nossa implementação accessLoggerMiddleware é mais completa
      if (env.isDevelopment) {
        logger.debug(`HTTP: ${trimmedMessage}`);
      }
    },
  };

  return morgan(format, { stream });
};

/**
 * Middleware para logging de erros
 * Delega para nosso logger mais robusto
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Nosso logger já registra a stack trace e outros detalhes
  logger.error(`${req.method} ${req.url} - Erro processando requisição`, err);

  // Continua para o próximo middleware de erro
  next(err);
};

// Re-exportamos nosso logger para compatibilidade com código existente
export const {
  info: logInfo,
  error: logError,
  warn: logWarn,
  debug: logDebug,
} = logger;
