import rateLimit from "express-rate-limit";
import { env } from "@/config/environment";

/**
 * Configuração do middleware rate-limiter
 * Limita o número de requisições por IP em um intervalo de tempo definido
 */
export const rateLimiterMiddleware = rateLimit({
  windowMs: env.rateLimit.windowMs, // Período de tempo definido nas variáveis de ambiente
  max: env.rateLimit.max, // Número máximo de requisições permitidas no período
  standardHeaders: true, // Retorna informações de limite no cabeçalho `RateLimit-*`
  legacyHeaders: false, // Desativa cabeçalhos `X-RateLimit-*` legados

  // Mensagem personalizada quando o limite é excedido
  message: {
    status: "error",
    message: "Muitas requisições, por favor tente novamente mais tarde.",
    code: "TOO_MANY_REQUESTS",
  },

  // Função para identificar requisições durante testes
  // Útil para evitar que testes sejam bloqueados pelo rate limiter
  skip: (req) => {
    return env.isTest && req.headers["x-skip-rate-limit"] === "true";
  },
});
