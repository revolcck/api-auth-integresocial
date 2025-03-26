import { env } from "@/config/environment";
import { redisService } from "@/config/redis";
import { JwtUtils } from "@/shared/utils/jwt.utils";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Serviço para gerenciamento de tokens (JWT)
 */
export class TokenService {
  /**
   * Prefixo para chaves de token de blacklist no Redis
   */
  private static readonly BLACKLIST_PREFIX = "token:blacklist:";

  /**
   * TTL para tokens na blacklist (em segundos)
   */
  private static readonly BLACKLIST_TTL = 60 * 60 * 24 * 7; // 7 dias

  /**
   * Gera um token de acesso para o usuário
   */
  public async generateAccessToken(
    userId: string,
    email: string,
    role: string
  ): Promise<string> {
    try {
      logger.debug(`Gerando access token para usuário ${userId}`);
      return JwtUtils.generateAccessToken({
        sub: userId,
        email,
        role,
      });
    } catch (error) {
      logger.error(`Erro ao gerar access token para usuário ${userId}`, error);
      throw error;
    }
  }

  /**
   * Gera um token de refresh para o usuário
   */
  public async generateRefreshToken(userId: string): Promise<string> {
    try {
      logger.debug(`Gerando refresh token para usuário ${userId}`);
      return JwtUtils.generateRefreshToken(userId);
    } catch (error) {
      logger.error(`Erro ao gerar refresh token para usuário ${userId}`, error);
      throw error;
    }
  }

  /**
   * Adiciona um token à blacklist
   */
  public async blacklistToken(token: string): Promise<void> {
    try {
      // Tenta decodificar o token para obter o ID do usuário para fins de log
      const decodedToken = JwtUtils.decodeToken(token);
      const userId = decodedToken?.sub || "desconhecido";

      logger.debug(`Adicionando token à blacklist para usuário ${userId}`);

      if (redisService.isConnected()) {
        const key = `${TokenService.BLACKLIST_PREFIX}${token}`;
        await redisService.set(key, "true", TokenService.BLACKLIST_TTL);
        logger.debug(
          `Token adicionado à blacklist no Redis para usuário ${userId}`
        );
      } else if (env.isDevelopment) {
        logger.warn(
          `Redis não está conectado. Ignorando blacklist em ambiente de desenvolvimento para usuário ${userId}`
        );
      } else {
        logger.error(
          `Falha ao adicionar token à blacklist: Redis não conectado`
        );
        throw new Error("Serviço Redis não está disponível");
      }
    } catch (error) {
      logger.error(`Erro ao adicionar token à blacklist`, error);

      // Em desenvolvimento, continuamos mesmo com erro
      if (!env.isDevelopment) {
        throw error;
      }
    }
  }

  /**
   * Verifica se um token está na blacklist
   */
  public async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      // Tenta decodificar o token para obter o ID do usuário para fins de log
      const decodedToken = JwtUtils.decodeToken(token);
      const userId = decodedToken?.sub || "desconhecido";

      logger.debug(
        `Verificando se token está na blacklist para usuário ${userId}`
      );

      if (redisService.isConnected()) {
        const key = `${TokenService.BLACKLIST_PREFIX}${token}`;
        const result = await redisService.exists(key);

        if (result) {
          logger.debug(`Token encontrado na blacklist para usuário ${userId}`);
        }

        return result;
      } else if (env.isDevelopment) {
        logger.warn(
          `Redis não está conectado. Ignorando verificação de blacklist em ambiente de desenvolvimento para usuário ${userId}`
        );
        return false;
      }

      // Em produção, tratamos como erro se o Redis não estiver disponível
      logger.error(
        `Falha ao verificar token na blacklist: Redis não conectado`
      );
      throw new Error("Serviço Redis não está disponível");
    } catch (error) {
      logger.error(`Erro ao verificar token na blacklist`, error);

      // Em desenvolvimento, continuamos mesmo com erro
      if (env.isDevelopment) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Verifica se um token é válido
   */
  public async verifyToken(token: string): Promise<{
    valid: boolean;
    expired: boolean;
    userId?: string;
    payload?: any;
  }> {
    try {
      // Verifica se o token está na blacklist
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return { valid: false, expired: false };
      }

      // Verifica a validade do token
      const result = await JwtUtils.verifyToken(token);
      const userId = result.payload?.sub;

      return {
        ...result,
        userId,
      };
    } catch (error) {
      logger.error(`Erro ao verificar token`, error);
      return { valid: false, expired: false };
    }
  }
}
