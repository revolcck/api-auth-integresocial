import { redisService } from "@/config/redis";
import { env } from "@/config/environment";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Interface para o serviço de cache
 */
export interface ICacheService {
  /**
   * Obtém um valor do cache
   * @param key Chave para busca
   * @returns Valor armazenado ou null se não existir
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Armazena um valor no cache
   * @param key Chave para identificação
   * @param value Valor a ser armazenado
   * @param ttlSeconds Tempo de vida em segundos (opcional)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Remove um valor do cache
   * @param key Chave do valor a ser removido
   */
  delete(key: string): Promise<void>;

  /**
   * Verifica se uma chave existe no cache
   * @param key Chave a ser verificada
   * @returns Verdadeiro se existir, falso caso contrário
   */
  exists(key: string): Promise<boolean>;

  /**
   * Limpa o cache com um determinado prefixo
   * @param prefix Prefixo das chaves a serem removidas
   */
  clearByPrefix(prefix: string): Promise<void>;

  /**
   * Obtém um valor do cache, ou executa uma função e armazena o resultado
   * @param key Chave para busca e armazenamento
   * @param fn Função a ser executada caso o valor não exista no cache
   * @param ttlSeconds Tempo de vida em segundos (opcional)
   * @returns Valor do cache ou resultado da função
   */
  getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T>;
}

/**
 * Implementação do serviço de cache usando Redis
 */
export class CacheService implements ICacheService {
  private readonly DEFAULT_TTL = 3600; // 1 hora em segundos
  private readonly keyPrefix: string;
  private readonly isEnabled: boolean;

  /**
   * Cria uma nova instância do serviço de cache
   * @param namespace Namespace para prefixar as chaves (evita colisões)
   */
  constructor(namespace: string = "app") {
    this.keyPrefix = `cache:${namespace}:`;

    // Habilita o cache apenas se o Redis estiver configurado e habilitado
    this.isEnabled = env.redis.enabled && Boolean(env.redis.host);

    logger.debug(
      `Serviço de cache ${this.isEnabled ? "habilitado" : "desabilitado"} para namespace "${namespace}"`
    );
  }

  /**
   * Formata uma chave adicionando o prefixo
   */
  private formatKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Obtém um valor do cache
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null;

    const formattedKey = this.formatKey(key);

    try {
      const value = await redisService.get(formattedKey);

      if (!value) {
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn(`Erro ao obter valor do cache: ${key}`, error);
      return null;
    }
  }

  /**
   * Armazena um valor no cache
   */
  public async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.isEnabled) return;

    const formattedKey = this.formatKey(key);
    const ttl = ttlSeconds || this.DEFAULT_TTL;

    try {
      const stringValue = JSON.stringify(value);
      await redisService.set(formattedKey, stringValue, ttl);
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.warn(`Erro ao armazenar valor no cache: ${key}`, error);
    }
  }

  /**
   * Remove um valor do cache
   */
  public async delete(key: string): Promise<void> {
    if (!this.isEnabled) return;

    const formattedKey = this.formatKey(key);

    try {
      await redisService.delete(formattedKey);
      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.warn(`Erro ao remover valor do cache: ${key}`, error);
    }
  }

  /**
   * Verifica se uma chave existe no cache
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.isEnabled) return false;

    const formattedKey = this.formatKey(key);

    try {
      return await redisService.exists(formattedKey);
    } catch (error) {
      logger.warn(`Erro ao verificar existência no cache: ${key}`, error);
      return false;
    }
  }

  /**
   * Limpa o cache com um determinado prefixo
   * Nota: Esta implementação é um exemplo e pode precisar ser adaptada
   * dependendo de como o Redis está configurado e quais comandos estão disponíveis
   */
  public async clearByPrefix(prefix: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Esta implementação requer acesso direto ao cliente Redis
      // que não está diretamente disponível através do redisService
      // Seria necessário adaptar o redisService para expor o cliente
      // ou implementar um método específico para esta operação
      logger.warn(
        "clearByPrefix não implementado: necessário acesso direto ao cliente Redis"
      );
    } catch (error) {
      logger.warn(`Erro ao limpar cache com prefixo: ${prefix}`, error);
    }
  }

  /**
   * Obtém um valor do cache, ou executa uma função e armazena o resultado
   */
  public async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Se o cache estiver desabilitado, simplesmente executa a função
    if (!this.isEnabled) {
      return fn();
    }

    try {
      // Tenta obter do cache primeiro
      const cachedValue = await this.get<T>(key);

      if (cachedValue !== null) {
        return cachedValue;
      }

      // Se não encontrou no cache, executa a função
      const result = await fn();

      // Armazena o resultado no cache
      await this.set(key, result, ttlSeconds);

      return result;
    } catch (error) {
      logger.warn(`Erro em getOrSet para chave: ${key}`, error);
      // Se houver qualquer erro com o cache, executa a função diretamente
      return fn();
    }
  }
}

// Cria instância padrão do serviço de cache
export const cacheService: ICacheService = new CacheService();
