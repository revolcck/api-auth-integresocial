import { logger, AuditData } from "@/shared/utils/logger.utils";
import { Request } from "express";

/**
 * Enum para tipos de ações auditáveis
 */
export enum AuditAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  REGISTER = "register",
  PASSWORD_CHANGE = "password_change",
  TOKEN_REFRESH = "token_refresh",
  PERMISSION_CHANGE = "permission_change",
  EXPORT = "export",
  IMPORT = "import",
}

/**
 * Serviço para auditoria de ações críticas no sistema
 */
export class AuditService {
  /**
   * Cria um registro de auditoria para uma ação
   *
   * @param action Tipo de ação realizada
   * @param resource Recurso afetado (ex: "user", "course")
   * @param resourceId ID do recurso afetado (opcional)
   * @param userId ID do usuário que realizou a ação
   * @param details Detalhes adicionais da ação
   * @param req Objeto de requisição Express (opcional)
   */
  public static log(
    action: AuditAction | string,
    resource: string,
    resourceId?: string,
    userId?: string,
    details?: object,
    req?: Request
  ): void {
    const auditData: AuditData = {
      action,
      resource,
      resourceId,
      userId,
      details,
      ip: req?.ip,
      method: req?.method,
      path: req?.originalUrl || req?.path,
    };

    logger.audit(auditData);
  }

  /**
   * Registra uma operação de criação
   */
  public static create(
    resource: string,
    resourceId: string,
    userId?: string,
    details?: object,
    req?: Request
  ): void {
    this.log(AuditAction.CREATE, resource, resourceId, userId, details, req);
  }

  /**
   * Registra uma operação de atualização
   */
  public static update(
    resource: string,
    resourceId: string,
    userId?: string,
    details?: object,
    req?: Request
  ): void {
    this.log(AuditAction.UPDATE, resource, resourceId, userId, details, req);
  }

  /**
   * Registra uma operação de exclusão
   */
  public static delete(
    resource: string,
    resourceId: string,
    userId?: string,
    details?: object,
    req?: Request
  ): void {
    this.log(AuditAction.DELETE, resource, resourceId, userId, details, req);
  }

  /**
   * Registra uma operação de login
   */
  public static login(
    userId: string,
    success: boolean,
    details?: object,
    req?: Request
  ): void {
    this.log(
      success ? AuditAction.LOGIN : "login_failed",
      "authentication",
      undefined,
      userId,
      {
        success,
        ...details,
      },
      req
    );
  }

  /**
   * Registra uma operação de logout
   */
  public static logout(userId: string, details?: object, req?: Request): void {
    this.log(
      AuditAction.LOGOUT,
      "authentication",
      undefined,
      userId,
      details,
      req
    );
  }
}
