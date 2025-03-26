import { Request, Response, NextFunction } from "express";
import { JwtUtils } from "@/shared/utils/jwt.utils";
import { UnauthorizedError, ForbiddenError } from "@/shared/errors/AppError";
import { prisma } from "@/config/database";
import { logger } from "@/shared/utils/logger.utils";
import { AuditService } from "@/shared/services/audit.service";
import { TokenService } from "@/modules/auth/services/token.service";

/**
 * Estende a interface Request do Express para incluir os dados do usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      token?: string; // Token JWT original
    }
  }
}

/**
 * Classe para gerenciar middlewares de autenticação e autorização
 */
export class AuthMiddleware {
  private tokenService: TokenService;

  constructor() {
    this.tokenService = new TokenService();
  }

  /**
   * Middleware para autenticação baseada em JWT
   * Verifica se o token no cabeçalho de autorização é válido
   */
  public authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Extrai o cabeçalho de autorização
      const authHeader = req.headers.authorization;

      // Verifica se o cabeçalho existe e tem o formato correto
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError(
          "Token de autenticação não fornecido",
          "AUTH_TOKEN_MISSING"
        );
      }

      // Extrai o token do cabeçalho
      const token = authHeader.split(" ")[1];

      // Verifica se o token foi fornecido
      if (!token) {
        throw new UnauthorizedError(
          "Token de autenticação não fornecido",
          "AUTH_TOKEN_MISSING"
        );
      }

      // Verifica se o token é válido (inclui verificação na blacklist)
      const tokenResult = await this.tokenService.verifyToken(token);

      // Verifica se o token é válido
      if (!tokenResult.valid) {
        if (tokenResult.expired) {
          throw new UnauthorizedError(
            "Token de autenticação expirado",
            "AUTH_TOKEN_EXPIRED"
          );
        }
        throw new UnauthorizedError(
          "Token de autenticação inválido",
          "AUTH_TOKEN_INVALID"
        );
      }

      // Verifica se o payload e o userId estão presentes
      if (!tokenResult.payload || !tokenResult.userId) {
        throw new UnauthorizedError(
          "Token de autenticação inválido",
          "AUTH_TOKEN_INVALID_PAYLOAD"
        );
      }

      // Verifica se o token é do tipo access
      if (tokenResult.payload.type !== "access") {
        throw new UnauthorizedError(
          "Tipo de token inválido para esta operação",
          "AUTH_TOKEN_INVALID_TYPE"
        );
      }

      // Busca o usuário no banco de dados para verificar se ainda existe e está ativo
      const user = await prisma.user.findUnique({
        where: { id: tokenResult.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedError(
          "Usuário não encontrado",
          "AUTH_USER_NOT_FOUND"
        );
      }

      // Adiciona os dados do usuário e o token ao objeto Request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      req.token = token;

      // Registra o acesso autenticado nos logs de auditoria (apenas para rotas sensíveis se necessário)
      this.logAuthenticatedAccess(req);

      // Continua para o próximo middleware
      next();
    } catch (error) {
      // Registra tentativas falhas de autenticação
      if (error instanceof UnauthorizedError) {
        logger.warn(`Falha na autenticação: ${error.message}`, {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          errorCode: error.errorCode,
        });
      }

      next(error);
    }
  };

  /**
   * Middleware para verificar se o usuário tem um dos papéis especificados
   * @param allowedRoles Array de papéis permitidos
   */
  public authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Verifica se o middleware authenticate foi executado antes
        if (!req.user) {
          throw new UnauthorizedError(
            "Usuário não autenticado",
            "AUTH_USER_NOT_AUTHENTICATED"
          );
        }

        // Verifica se o usuário tem um dos papéis permitidos
        if (!allowedRoles.includes(req.user.role)) {
          // Registra tentativa de acesso não autorizado
          logger.warn(
            `Acesso não autorizado: usuário ${req.user.id} com papel ${req.user.role} tentou acessar rota restrita`,
            {
              path: req.path,
              method: req.method,
              allowedRoles,
            }
          );

          throw new ForbiddenError(
            "Você não tem permissão para acessar este recurso",
            "AUTH_INSUFFICIENT_ROLE"
          );
        }

        // Continua para o próximo middleware
        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Middleware que verifica se o usuário é o proprietário do recurso
   * @param getResourceOwnerId Função que obtém o ID do usuário proprietário do recurso
   */
  public authorizeOwner = (
    getResourceOwnerId: (req: Request) => Promise<string | null>
  ) => {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        // Verifica se o middleware authenticate foi executado antes
        if (!req.user) {
          throw new UnauthorizedError(
            "Usuário não autenticado",
            "AUTH_USER_NOT_AUTHENTICATED"
          );
        }

        // Obtém o ID do usuário proprietário do recurso
        const ownerId = await getResourceOwnerId(req);

        // Verifica se o recurso existe
        if (ownerId === null) {
          throw new ForbiddenError(
            "Recurso não encontrado",
            "RESOURCE_NOT_FOUND"
          );
        }

        // Verifica se o usuário é o proprietário do recurso ou um admin
        if (req.user.id !== ownerId && req.user.role !== "ADMIN") {
          // Registra tentativa de acesso não autorizado
          logger.warn(
            `Acesso não autorizado: usuário ${req.user.id} tentou acessar recurso de outro usuário ${ownerId}`,
            {
              path: req.path,
              method: req.method,
            }
          );

          throw new ForbiddenError(
            "Você não tem permissão para acessar este recurso",
            "AUTH_NOT_RESOURCE_OWNER"
          );
        }

        // Continua para o próximo middleware
        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Registra o acesso autenticado nos logs de auditoria
   */
  private logAuthenticatedAccess(req: Request): void {
    // Determina se essa é uma rota que precisa ser auditada
    // Pode ser configurado para apenas auditar rotas sensíveis
    const sensitiveRoutes = ["/api/auth/change-password", "/api/users/me"];

    const shouldAudit = sensitiveRoutes.some((route) =>
      req.originalUrl.includes(route)
    );

    if (shouldAudit && req.user) {
      AuditService.log(
        "authenticated_access",
        "authentication",
        undefined,
        req.user.id,
        {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        }
      );
    }
  }
}

// Exporta instância para uso nos middlewares
const authMiddlewareInstance = new AuthMiddleware();

// Exporta middlewares para uso nas rotas
export const authenticate = authMiddlewareInstance.authenticate;
export const authorize = authMiddlewareInstance.authorize;
export const authorizeOwner = authMiddlewareInstance.authorizeOwner;
