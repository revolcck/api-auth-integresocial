import { createApp } from "@/config/app";
import { env } from "@/config/environment";
import { db } from "@/config/database";
import { redisService } from "@/config/redis";
import { logger } from "@/shared/utils/logger.utils";
import { ServerBannerUtils } from "@/shared/utils/server-banner.utils";

class Server {
  /**
   * Instância da aplicação Express
   */
  private app = createApp();

  /**
   * Servidor HTTP
   */
  private server: any;

  /**
   * Inicializa o servidor e suas dependências
   */
  public async start(): Promise<void> {
    try {
      // Inicializa conexões com serviços externos
      await this.initializeConnections();

      // Inicia o servidor HTTP
      this.startHttpServer();

      // Configura relatório periódico de status em desenvolvimento
      this.setupPeriodicReporting();

      // Configura handlers para encerramento gracioso
      this.setupShutdownHandlers();
    } catch (error) {
      logger.error("❌ Falha ao iniciar o servidor", error);
      process.exit(1);
    }
  }

  /**
   * Inicializa conexões com serviços externos (banco de dados, redis, etc)
   */
  private async initializeConnections(): Promise<void> {
    try {
      // Conecta ao banco de dados
      await db.connect();

      // Variáveis para status das conexões
      let databaseConnected = false;
      let redisConnected = false;
      let databaseConnections = 0;

      try {
        // Verifica se a conexão com o banco foi bem sucedida
        const result = await db.getClient().$queryRaw`SELECT 1`;
        databaseConnected = true;

        // Obtém o número de conexões do pool MySQL
        try {
          const poolStats = await db.getClient()
            .$queryRaw`SHOW STATUS LIKE 'Threads_connected'`;
          if (Array.isArray(poolStats) && poolStats.length > 0) {
            databaseConnections = Number(poolStats[0].Value) || 0;
          }
        } catch (poolError) {
          databaseConnections = 1; // Assume pelo menos 1 conexão
        }
      } catch (error) {
        databaseConnected = false;
        logger.error("Erro ao verificar conexão com banco de dados", error);
      }

      // Conecta ao Redis se estiver configurado
      if (env.redis.host) {
        try {
          await redisService.connect();
          redisConnected = redisService.isConnected();
        } catch (error) {
          redisConnected = false;
          // Em desenvolvimento, continuamos mesmo sem Redis
          if (!env.isDevelopment) {
            throw error;
          }
        }
      }

      // Exibe banner com informações do sistema e status das conexões
      ServerBannerUtils.showBanner({
        database: databaseConnected,
        redis: redisConnected,
        databaseConnections,
      });

      // Logs adicionais sobre conexões para o arquivo de log
      this.logConnectionStatus(
        databaseConnected,
        redisConnected,
        databaseConnections
      );
    } catch (error) {
      logger.error("Falha ao inicializar conexões", error);
      throw error;
    }
  }

  /**
   * Registra logs de status das conexões
   */
  private logConnectionStatus(
    databaseConnected: boolean,
    redisConnected: boolean,
    databaseConnections: number
  ): void {
    if (databaseConnected) {
      logger.info("✅ Conexão com banco de dados estabelecida com sucesso", {
        type: "mysql",
        connections: databaseConnections,
        url: env.databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"), // Oculta credenciais
      });
    }

    if (redisConnected) {
      logger.info("✅ Conexão com Redis estabelecida com sucesso", {
        host: env.redis.host,
        port: env.redis.port,
      });
    } else if (env.redis.host) {
      logger.warn("⚠️ Conexão com Redis não estabelecida", {
        host: env.redis.host,
        port: env.redis.port,
      });
    }
  }

  /**
   * Inicia o servidor HTTP
   */
  private startHttpServer(): void {
    this.server = this.app.listen(env.port, () => {
      logger.info(`🚀 Servidor rodando em http://localhost:${env.port}`);
      logger.info(`🌎 Ambiente: ${env.nodeEnv}`);

      // Registra métricas iniciais
      const memUsage = process.memoryUsage();
      logger.debug("Métricas iniciais", {
        memory: {
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        },
        cpu: process.cpuUsage(),
      });
    });

    // Configura timeout do servidor
    this.server.timeout = 30000; // 30 segundos
  }

  /**
   * Configura relatório periódico de status em desenvolvimento
   */
  private setupPeriodicReporting(): void {
    if (env.isDevelopment) {
      // A cada 15 minutos, exibe um relatório de status
      setInterval(ServerBannerUtils.generateStatusReport, 15 * 60 * 1000);
    }
  }

  /**
   * Configura handlers para encerramento gracioso da aplicação
   */
  private setupShutdownHandlers(): void {
    // Função para encerrar conexões graciosamente
    const shutdown = async (): Promise<void> => {
      logger.info("🛑 Recebido sinal para encerrar o aplicativo");

      try {
        // Fecha servidor HTTP primeiro (para não aceitar novas requisições)
        if (this.server) {
          await new Promise<void>((resolve) => {
            this.server.close(() => {
              logger.info("🔌 Servidor HTTP fechado");
              resolve();
            });
          });
        }

        // Desconecta do banco de dados
        await db.disconnect();
        logger.info("🔌 Conexão com banco de dados fechada");

        // Desconecta do Redis se estiver conectado
        if (redisService.isConnected()) {
          await redisService.disconnect();
          logger.info("🔌 Conexão com Redis fechada");
        }

        // Fecha streams de log
        if (logger.closeStreams) {
          logger.closeStreams();
        }

        logger.info("✅ Conexões encerradas com sucesso");

        // Dá tempo para os logs serem gravados antes de encerrar
        setTimeout(() => {
          process.exit(0);
        }, 500);
      } catch (error) {
        logger.error("❌ Erro ao encerrar conexões", error);
        process.exit(1);
      }
    };

    // Registra handlers para sinais de encerramento
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Tratamento global de exceções não capturadas
    process.on("uncaughtException", (error) => {
      logger.error("🔥 Exceção não capturada", error);

      // Em produção, é melhor encerrar o processo
      if (env.isProduction) {
        process.exit(1);
      }
    });

    // Tratamento global de rejeições de promessas não capturadas
    process.on("unhandledRejection", (reason) => {
      logger.error("🔥 Rejeição de promessa não tratada", reason);

      // Em produção, é melhor encerrar o processo
      if (env.isProduction) {
        process.exit(1);
      }
    });
  }
}

// Inicializa e inicia o servidor
(async () => {
  const server = new Server();
  await server.start();
})();
