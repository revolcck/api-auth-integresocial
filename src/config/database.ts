import { PrismaClient, Prisma } from "@prisma/client";
import { env } from "./environment";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Interface para um serviço de banco de dados
 */
export interface IDatabaseService {
  /**
   * Obtém a instância do cliente Prisma
   */
  getClient(): PrismaClient;

  /**
   * Conecta ao banco de dados
   */
  connect(): Promise<void>;

  /**
   * Desconecta do banco de dados
   */
  disconnect(): Promise<void>;

  /**
   * Executa uma operação dentro de uma transação
   * @param fn Função que recebe o cliente de transação e executa operações
   * @returns Resultado da função
   */
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;

  /**
   * Verifica a saúde da conexão com o banco de dados
   * @returns Informações sobre a saúde da conexão
   */
  healthCheck(): Promise<{
    isConnected: boolean;
    responseTime: number;
    connections: number;
  }>;
}

/**
 * Opções de log baseadas no ambiente
 */
const getLogLevels = () => {
  if (env.isDevelopment) {
    return ["query", "info", "warn", "error"] as const;
  }

  if (env.isTest) {
    return ["warn", "error"] as const;
  }

  return ["warn", "error"] as const;
};

/**
 * Middleware do Prisma para logging de queries (apenas em desenvolvimento)
 * Não registra informações sensíveis como senhas
 */
const prismaLoggingMiddleware = async (
  params: Prisma.MiddlewareParams,
  next: (params: Prisma.MiddlewareParams) => Promise<any>
) => {
  if (!env.isDevelopment) {
    return next(params);
  }

  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const executionTime = after - before;

  // Não loga mutations em tabelas sensíveis
  const sensitiveOperations = [
    "findUniqueUser",
    "createUser",
    "updateUser",
    "upsertUser",
  ];

  // Verifica se a operação envolve uma tabela sensível
  const isSensitiveOperation = sensitiveOperations.some((op) =>
    params.action.startsWith(op)
  );

  // Loga a operação, omitindo dados sensíveis se necessário
  logger.debug(
    `Prisma Query: ${params.model}.${params.action} (${executionTime}ms)`,
    {
      model: params.model,
      action: params.action,
      executionTime: `${executionTime}ms`,
      args: isSensitiveOperation
        ? { select: params.args?.select, where: params.args?.where }
        : params.args,
    }
  );

  return result;
};

/**
 * Classe Singleton para gerenciar a conexão com o banco de dados via Prisma
 */
class DatabaseService implements IDatabaseService {
  private static instance: DatabaseService;
  private _prisma: PrismaClient;
  private isConnected: boolean = false;

  /**
   * Construtor privado que inicializa a conexão com o banco de dados
   */
  private constructor() {
    this._prisma = new PrismaClient({
      log: [...getLogLevels()],
      datasources: {
        db: {
          url: env.databaseUrl,
        },
      },
      // Nota: O Prisma não suporta diretamente a configuração de pool
      // O pool é gerenciado automaticamente, consulte a documentação
      // para mais detalhes sobre otimização de conexões
    });

    // Adiciona middleware para logging
    this._prisma.$use(prismaLoggingMiddleware);
  }

  /**
   * Método estático para obter a instância única do Database
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Getter para acessar o cliente Prisma
   */
  public getClient(): PrismaClient {
    return this._prisma;
  }

  /**
   * Método para conectar ao banco de dados
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug("Conexão com banco de dados já estabelecida");
      return;
    }

    try {
      await this._prisma.$connect();
      this.isConnected = true;
      logger.info("✅ Conexão com banco de dados estabelecida com sucesso");
    } catch (error) {
      this.isConnected = false;
      logger.error("❌ Erro ao conectar ao banco de dados:", error);
      throw error;
    }
  }

  /**
   * Método para desconectar do banco de dados
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug("Banco de dados já está desconectado");
      return;
    }

    try {
      await this._prisma.$disconnect();
      this.isConnected = false;
      logger.info("🔌 Conexão com banco de dados fechada");
    } catch (error) {
      logger.error("❌ Erro ao desconectar do banco de dados:", error);
      throw error;
    }
  }

  /**
   * Executa uma operação dentro de uma transação
   * @param fn Função que recebe o cliente de transação e executa operações
   * @returns Resultado da função
   */
  public async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      const result = await this._prisma.$transaction(fn);
      return result;
    } catch (error) {
      logger.error("Erro durante transação do banco de dados:", error);
      throw error;
    }
  }

  /**
   * Verifica a saúde da conexão com o banco de dados
   */
  public async healthCheck(): Promise<{
    isConnected: boolean;
    responseTime: number;
    connections: number;
  }> {
    try {
      // Mede o tempo de resposta
      const startTime = process.hrtime();

      // Executa uma query simples
      await this._prisma.$queryRaw`SELECT 1`;

      // Calcula o tempo de resposta
      const hrTime = process.hrtime(startTime);
      const responseTime = Math.round(hrTime[0] * 1000 + hrTime[1] / 1000000);

      // Obtém o número de conexões (específico para MySQL/MariaDB)
      let connections = 0;
      try {
        const poolStats = await this._prisma
          .$queryRaw`SHOW STATUS LIKE 'Threads_connected'`;
        if (Array.isArray(poolStats) && poolStats.length > 0) {
          connections = Number(poolStats[0].Value) || 0;
        }
      } catch (error) {
        logger.debug("Não foi possível obter estatísticas de conexão", error);
        connections = 1; // Assume pelo menos 1 conexão
      }

      return {
        isConnected: true,
        responseTime,
        connections,
      };
    } catch (error) {
      logger.error("Erro durante health check do banco de dados:", error);
      return {
        isConnected: false,
        responseTime: -1,
        connections: 0,
      };
    }
  }
}

// Exporta uma instância única do banco de dados
export const db: IDatabaseService = DatabaseService.getInstance();

// Exporta o cliente Prisma para uso direto quando necessário
export const prisma = db.getClient();
