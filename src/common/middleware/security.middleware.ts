import { INestApplication } from '@nestjs/common';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { appConfig } from '../../config';

/**
 * Configura middlewares de segurança para a aplicação
 * @param app Instância da aplicação NestJS
 */
export function setupSecurityMiddleware(app: INestApplication): void {
  const config = appConfig();

  // Helmet para proteção de cabeçalhos HTTP
  app.use(
    helmet({
      // Configurações específicas do Helmet
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          connectSrc: ["'self'"],
        },
      },
      // Melhora a proteção contra clickjacking
      frameguard: {
        action: 'deny',
      },
      // Evita que o navegador MIME-sniffing uma resposta para outro tipo de conteúdo
      noSniff: true,
      // Habilita o modo estrito para as cookies
      hsts: {
        maxAge: 63072000, // 2 anos
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // CORS configurado com base no ambiente
  app.enableCors({
    origin: config.isProduction
      ? [/\.integresocial\.cloud$/] // Apenas domínios do integresocial.cloud em produção
      : true, // Qualquer origem em desenvolvimento
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true, // Permite cookies nas requisições cross-origin
    maxAge: 86400, // Cache CORS por 24 horas
  });

  // Parser de cookies com assinatura
  app.use(cookieParser(config.security.jwtSecret.substring(0, 32)));

  // Rate limiting simples
  // Em produção, considere usar um módulo como o nest-rate-limiter ou @nestjs/throttler
  if (config.isProduction) {
    const requestCounts = new Map<
      string,
      { count: number; resetTime: number }
    >();

    app.use((req, res, next) => {
      const clientIP = req.ip;
      const now = Date.now();
      const resetTime = now + 60 * 1000; // 1 minuto

      if (!requestCounts.has(clientIP)) {
        requestCounts.set(clientIP, { count: 1, resetTime });
      } else {
        const client = requestCounts.get(clientIP)!;

        if (now > client.resetTime) {
          client.count = 1;
          client.resetTime = resetTime;
        } else {
          client.count++;

          if (client.count > 100) {
            // Limite de 100 requisições por minuto
            return res.status(429).json({
              statusCode: 429,
              message: 'Too Many Requests',
              error: 'Muitas requisições. Por favor, tente novamente em breve.',
            });
          }
        }
      }

      next();
    });

    // Limpeza periódica do mapa de IPs
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
          requestCounts.delete(ip);
        }
      }
    }, 60 * 1000); // Limpa a cada minuto
  }
}
