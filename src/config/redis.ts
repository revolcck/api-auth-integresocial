import { createClient, RedisClientType } from "redis";
import { env } from "./environment";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Interface para operações do Redis
 * Facilita mock em testes e garante o contrato de métodos
 */
export interface IRedisService {
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  set(key: string, value: string, expireInSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Classe Singleton para gerenciar a conexão com o Redis
 * Implementa a interface IRedisService
 */
class RedisService implements IRedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;
  private isClientConnected: boolean = false;
  private isConnecting: boolean = false;
  private hasLoggedSuccess: boolean = false;

  /**
   * Tempo de timeout para tentativas de reconexão em produção (ms)
   */
  private readonly RECONNECT_TIMEOUT = 5000;

  /**
   * Número máximo de tentativas de reconexão
   */
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  /**
   * Construtor privado que inicializa a configuração do Redis
   */
  private constructor() {
    this.initializeClient();
  }

  /**
   * Inicializa o cliente Redis com configurações adequadas para o ambiente
   */
  private initializeClient(): void {
    const url = this.buildRedisUrl();

    // Se não tem URL configurada, não inicializa o cliente
    if (!url) {
      logger.debug(`Redis não configurado. Operando sem Redis.`);
      return;
    }

    logger.debug(`Inicializando cliente Redis: ${this.getSafeUrl(url)}`);

    // Cria o cliente Redis com configurações adequadas
    this.client = createClient({
      url,
      socket: {
        // Estratégia de reconexão adaptativa ao ambiente
        reconnectStrategy: this.getReconnectStrategy(),
        connectTimeout: 10000, // 10 segundos de timeout na conexão
      },
    });

    // Configuração de listeners para eventos do Redis
    this.setupEventListeners();
  }

  /**
   * Retorna uma estratégia de reconexão apropriada para o ambiente
   */
  private getReconnectStrategy(): false | ((retries: number) => number) {
    if (env.isDevelopment) {
      // Em desenvolvimento, não tentamos reconectar automaticamente
      return false;
    }

    // Em produção, reconexão adaptativa com limite de tentativas
    return (retries) => {
      if (retries > this.MAX_RECONNECT_ATTEMPTS) {
        return this.RECONNECT_TIMEOUT;
      }
      // Backoff exponencial limitado
      return Math.min(retries * 500, 3000);
    };
  }

  /**
   * Configura os listeners de eventos para o cliente Redis
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on("connect", () => {
      if (!this.hasLoggedSuccess) {
        logger.info("🔄 Redis: Iniciando conexão...");
      }
    });

    this.client.on("ready", () => {
      this.isClientConnected = true;
      if (!this.hasLoggedSuccess) {
        logger.info("✅ Redis: Conexão estabelecida com sucesso");
        this.hasLoggedSuccess = true;
      }
    });

    this.client.on("error", (err) => {
      // Em desenvolvimento, evitamos mensagens de erro repetidas para conexão recusada
      if (env.isDevelopment && err.code === "ECONNREFUSED") {
        if (!this.hasLoggedSuccess) {
          logger.warn(
            "⚠️ Redis: Não foi possível conectar em ambiente de desenvolvimento",
            { code: err.code }
          );
        }
      } else {
        logger.error("❌ Redis: Erro na conexão", {
          message: err.message,
          code: err.code,
          stack: err.stack,
        });
      }
      this.isClientConnected = false;
    });

    this.client.on("end", () => {
      this.isClientConnected = false;
      this.hasLoggedSuccess = false;
      logger.info("🔌 Redis: Conexão encerrada");
    });

    this.client.on("reconnecting", () => {
      logger.info("🔄 Redis: Tentando reconectar...");
    });
  }

  /**
   * Constrói a URL de conexão com o Redis baseada nas variáveis de ambiente
   */
  private buildRedisUrl(): string | null {
    const { host, port, password } = env.redis;

    // Se não houver host configurado, retorna nulo
    if (!host) {
      return null;
    }

    const authPart = password ? `:${password}@` : "";
    return `redis://${authPart}${host}:${port}`;
  }

  /**
   * Retorna uma versão segura da URL (sem senha) para logs
   */
  private getSafeUrl(url: string | null): string {
    if (!url) return "none";
    // Substitui a senha por asteriscos usando uma abordagem mais robusta
    return url.replace(/(:.*?@)/g, ":***@");
  }

  /**
   * Método estático para obter a instância única do RedisService
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Verifica se a conexão com o Redis está ativa
   */
  public isConnected(): boolean {
    return this.isClientConnected;
  }

  /**
   * Método para conectar ao Redis
   * Deve ser chamado explicitamente durante a inicialização da aplicação
   */
  public async connect(): Promise<void> {
    // Evita múltiplas tentativas de conexão simultâneas
    if (this.isClientConnected || this.isConnecting || !this.client) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info("🔄 Redis: Tentando conectar...", {
        host: env.redis.host,
        port: env.redis.port,
      });

      // Tenta estabelecer a conexão
      await this.client.connect();

      // Se não lançou exceção, a conexão foi bem sucedida
      this.isClientConnected = true;
      this.hasLoggedSuccess = true;
      logger.info("✅ Redis: Conexão estabelecida com sucesso");
    } catch (error) {
      this.isClientConnected = false;

      if (env.isDevelopment) {
        logger.warn(
          "⚠️ Redis: Continuando sem Redis em ambiente de desenvolvimento",
          { error: error instanceof Error ? error.message : String(error) }
        );
        logger.warn(
          "   Para habilitar o Redis, verifique se o serviço está rodando na porta 6379"
        );
      } else {
        logger.error("❌ Redis: Erro fatal ao conectar", error);
        throw error;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Método para desconectar do Redis
   * Deve ser chamado quando a aplicação for encerrada
   */
  public async disconnect(): Promise<void> {
    if (this.isClientConnected && this.client) {
      try {
        await this.client.disconnect();
        this.isClientConnected = false;
        this.hasLoggedSuccess = false;
        logger.info("🔌 Redis: Conexão encerrada com sucesso");
      } catch (error) {
        logger.error("❌ Redis: Erro ao desconectar", error);
        throw error;
      }
    }
  }

  /**
   * Armazena um valor no Redis com uma chave especificada
   */
  public async set(
    key: string,
    value: string,
    expireInSeconds?: number
  ): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      if (expireInSeconds) {
        await this.client!.set(key, value, { EX: expireInSeconds });
        logger.debug(`Redis: SET ${key} (expira em ${expireInSeconds}s)`);
      } else {
        await this.client!.set(key, value);
        logger.debug(`Redis: SET ${key}`);
      }
    } catch (error) {
      this.handleOperationError("set", error);
    }
  }

  /**
   * Recupera um valor do Redis pela chave
   */
  public async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(key);
      logger.debug(
        `Redis: GET ${key} ${value ? "(encontrado)" : "(não encontrado)"}`
      );
      return value;
    } catch (error) {
      return this.handleOperationError("get", error);
    }
  }

  /**
   * Remove um valor do Redis pela chave
   */
  public async delete(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client!.del(key);
      logger.debug(`Redis: DEL ${key}`);
    } catch (error) {
      this.handleOperationError("delete", error);
    }
  }

  /**
   * Verifica se uma chave existe no Redis
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      logger.debug(`Redis: EXISTS ${key} (${result === 1 ? "sim" : "não"})`);
      return result === 1;
    } catch (error) {
      return this.handleOperationError("exists", error);
    }
  }

  /**
   * Verifica se o Redis está disponível para operações
   */
  private isAvailable(): boolean {
    if (!this.isClientConnected || !this.client) {
      if (env.isDevelopment) {
        return false; // Em desenvolvimento, simplesmente retorna falso
      }
      throw new Error("Redis não está conectado");
    }
    return true;
  }

  /**
   * Manipula erros de operações do Redis de forma consistente
   */
  private handleOperationError<T>(operation: string, error: unknown): T {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Erro na operação ${operation} do Redis:`, {
      error: errorMessage,
    });

    if (env.isDevelopment) {
      // Em desenvolvimento, retornamos valores padrão seguros
      switch (operation) {
        case "get":
          return null as T;
        case "exists":
          return false as T;
        default:
          return undefined as T;
      }
    }

    // Em produção, propagamos o erro
    throw error;
  }
}

// Exporta uma instância única do serviço Redis
export const redisService: IRedisService = RedisService.getInstance();
