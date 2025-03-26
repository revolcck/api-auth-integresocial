import * as jose from "jose";
import { env } from "@/config/environment";
import { logger } from "./logger.utils";

/**
 * Interface para payload do token JWT
 */
export interface TokenPayload {
  sub: string; // ID do usuário
  name?: string; // Nome do usuário
  email?: string; // Email do usuário
  role?: string; // Papel do usuário
  jti?: string; // ID único do token
  type?: string; // Tipo de token (access/refresh)
  [key: string]: any; // Propriedades adicionais
}

/**
 * Resultado da verificação de um token
 */
export interface VerifyResult {
  valid: boolean; // Se o token é válido
  expired: boolean; // Se o token está expirado
  payload?: TokenPayload; // Payload do token, se válido
  error?: Error; // Erro original, se houver
}

/**
 * Classe para gerenciamento de tokens JWT
 * Fornece métodos para geração, validação e refresh de tokens
 */
export class JwtUtils {
  /**
   * Algoritmo utilizado para assinatura dos tokens
   */
  private static readonly ALGORITHM = "HS256";

  /**
   * Chave secreta compartilhada para assinar tokens
   * Convertida para TextEncoder para compatibilidade com jose
   */
  private static get secretKey(): Uint8Array {
    return new TextEncoder().encode(env.jwt.secret);
  }

  /**
   * Gera um ID único para o token
   */
  private static generateTokenId(): string {
    // Gera um UUID v4 ou ID aleatório para o token
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Gera um token JWT de acesso
   * @param payload Dados a serem incluídos no token
   * @returns Token JWT gerado
   */
  public static async generateAccessToken(
    payload: Omit<TokenPayload, "type" | "jti">
  ): Promise<string> {
    try {
      const jwt = await new jose.SignJWT({
        ...payload,
        type: "access",
        jti: this.generateTokenId(),
      })
        .setProtectedHeader({ alg: this.ALGORITHM })
        .setIssuedAt()
        .setExpirationTime(env.jwt.expiresIn)
        .setSubject(payload.sub)
        .setIssuer("api-projeto")
        .setAudience("api-clients")
        .sign(this.secretKey);

      return jwt;
    } catch (error) {
      logger.error("Erro ao gerar access token:", error);
      throw new Error("Falha ao gerar token de acesso");
    }
  }

  /**
   * Gera um token JWT para refresh
   * @param userId ID do usuário
   * @returns Token JWT de refresh
   */
  public static async generateRefreshToken(userId: string): Promise<string> {
    try {
      const jwt = await new jose.SignJWT({
        type: "refresh",
        jti: this.generateTokenId(),
      })
        .setProtectedHeader({ alg: this.ALGORITHM })
        .setIssuedAt()
        .setExpirationTime(env.jwt.refreshExpiresIn)
        .setSubject(userId)
        .setIssuer("api-projeto")
        .setAudience("api-clients")
        .sign(this.secretKey);

      return jwt;
    } catch (error) {
      logger.error("Erro ao gerar refresh token:", error);
      throw new Error("Falha ao gerar token de refresh");
    }
  }

  /**
   * Verifica se um token JWT é válido
   * @param token Token JWT a ser verificado
   * @returns Resultado da verificação
   */
  public static async verifyToken(token: string): Promise<VerifyResult> {
    try {
      // Verifica a assinatura e validade do token
      const { payload } = await jose.jwtVerify(token, this.secretKey, {
        algorithms: [this.ALGORITHM],
        issuer: "api-projeto",
        audience: "api-clients",
      });

      // Converte o payload para o formato esperado
      const tokenPayload: TokenPayload = {
        sub: payload.sub as string,
        ...payload,
      };

      return {
        valid: true,
        expired: false,
        payload: tokenPayload,
      };
    } catch (error) {
      // Captura erros específicos para fornecer feedback mais preciso
      if (error instanceof jose.errors.JWTExpired) {
        return {
          valid: false,
          expired: true,
          error,
        };
      }

      // Log do erro específico
      logger.debug(
        `Erro ao verificar token: ${error instanceof Error ? error.message : String(error)}`
      );

      // Qualquer outro erro de validação
      return {
        valid: false,
        expired: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Decodifica um token JWT sem verificar a assinatura
   * Útil para debugging ou quando a verificação já ocorreu
   * @param token Token JWT a ser decodificado
   * @returns Payload do token ou null se inválido
   */
  public static decodeToken(token: string): TokenPayload | null {
    try {
      // Decodifica o token sem verificar a assinatura
      const decoded = jose.decodeJwt(token);

      return {
        sub: decoded.sub as string,
        ...decoded,
      };
    } catch (error) {
      logger.debug(
        `Erro ao decodificar token: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Extrai ID do usuário de um token jwt
   * Não verifica a validade do token, apenas extrai o subject
   * @param token Token JWT
   * @returns ID do usuário ou null se inválido
   */
  public static extractUserId(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.sub || null;
  }
}
