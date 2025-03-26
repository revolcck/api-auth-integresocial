import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import "express-async-errors";
import { morganMiddleware, errorLogger } from "@/shared/utils/logger.utils";
import { errorMiddleware } from "@/shared/middleware/error.middleware";
import { rateLimiterMiddleware } from "@/shared/middleware/rate-limiter";
import { accessLoggerMiddleware } from "@/shared/middleware/access-logger.middleware";
import routes from "@/routes";
import { env } from "@/config/environment";

/**
 * Aplicação Express configurada
 */
export interface IApplicationConfig {
  createApp(): Express;
}

/**
 * Implementação padrão da configuração da aplicação
 */
export class ApplicationConfig implements IApplicationConfig {
  /**
   * Inicializa e configura a aplicação Express
   * @returns Aplicação Express configurada
   */
  public createApp(): Express {
    const app = express();

    // Aplica middlewares na ordem correta
    this.configureLogging(app);
    this.configureSecurity(app);
    this.configureRequestParsing(app);
    this.configureRateLimiting(app);
    this.configureHealthCheck(app);
    this.configureRoutes(app);
    this.configureErrorHandling(app);

    return app;
  }

  /**
   * Configura os middlewares de logging
   */
  private configureLogging(app: Express): void {
    app.use(accessLoggerMiddleware);
    app.use(morganMiddleware());
  }

  /**
   * Configura os middlewares de segurança
   */
  private configureSecurity(app: Express): void {
    // Middleware para segurança geral
    app.use(helmet());

    // Middleware para CORS
    app.use(
      cors({
        origin: this.getCorsOrigin(),
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      })
    );
  }

  /**
   * Determina a configuração de CORS baseada no ambiente
   */
  private getCorsOrigin(): string[] | RegExp | string {
    if (env.isProduction) {
      return (
        process.env.ALLOWED_ORIGINS?.split(",") || ["https://seu-dominio.com"]
      );
    }
    return "*";
  }

  /**
   * Configura os middlewares para parsing de requisições
   */
  private configureRequestParsing(app: Express): void {
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  }

  /**
   * Configura rate limiting
   */
  private configureRateLimiting(app: Express): void {
    app.use(rateLimiterMiddleware);
  }

  /**
   * Configura rota de healthcheck
   */
  private configureHealthCheck(app: Express): void {
    app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.nodeEnv,
        memoryUsage: this.formatMemoryUsage(process.memoryUsage()),
      });
    });
  }

  /**
   * Formata o uso de memória para valores legíveis
   */
  private formatMemoryUsage(memoryUsage: NodeJS.MemoryUsage) {
    return {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    };
  }

  /**
   * Configura as rotas da aplicação
   */
  private configureRoutes(app: Express): void {
    app.use("/api", routes);
  }

  /**
   * Configura o tratamento de erros
   */
  private configureErrorHandling(app: Express): void {
    app.use(errorLogger);
    app.use(errorMiddleware);
  }
}

/**
 * Cria uma instância da aplicação Express configurada
 * @returns Aplicação Express configurada
 */
export function createApp(): Express {
  const appConfig = new ApplicationConfig();
  return appConfig.createApp();
}
