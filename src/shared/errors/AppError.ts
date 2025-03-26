/**
 * Classe base para erros da aplicação
 * Permite tratar erros de negócio de forma padronizada
 */
export class AppError extends Error {
  /**
   * Código de status HTTP associado ao erro
   */
  public readonly statusCode: number;

  /**
   * Código de erro para identificação programática
   */
  public readonly errorCode: string;

  /**
   * Metadados adicionais do erro
   */
  public readonly meta?: Record<string, any>;

  /**
   * Construtor da classe de erro
   * @param message Mensagem de erro descritiva
   * @param statusCode Código de status HTTP (default: 400 Bad Request)
   * @param errorCode Código de erro para identificação programática
   * @param meta Metadados adicionais do erro
   */
  constructor(
    message: string,
    statusCode = 400,
    errorCode = "BAD_REQUEST",
    meta?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.meta = meta;
    this.name = this.constructor.name;

    // Necessário para manter a cadeia de protótipos adequada
    Object.setPrototypeOf(this, AppError.prototype);

    // Captura a stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializa o erro para resposta HTTP
   */
  public serialize(): Record<string, any> {
    return {
      status: "error",
      code: this.errorCode,
      message: this.message,
      ...(this.meta ? { meta: this.meta } : {}),
    };
  }
}

/**
 * Erro específico para quando o usuário não está autenticado
 */
export class UnauthorizedError extends AppError {
  constructor(
    message = "Não autorizado. Autenticação necessária.",
    errorCode = "UNAUTHORIZED",
    meta?: Record<string, any>
  ) {
    super(message, 401, errorCode, meta);
  }
}

/**
 * Erro específico para quando o usuário não tem permissão para acessar o recurso
 */
export class ForbiddenError extends AppError {
  constructor(
    message = "Acesso proibido. Você não tem permissão para acessar este recurso.",
    errorCode = "FORBIDDEN",
    meta?: Record<string, any>
  ) {
    super(message, 403, errorCode, meta);
  }
}

/**
 * Erro específico para quando o recurso não é encontrado
 */
export class NotFoundError extends AppError {
  constructor(
    resource = "Recurso",
    errorCode = "NOT_FOUND",
    meta?: Record<string, any>
  ) {
    super(`${resource} não encontrado.`, 404, errorCode, meta);
  }
}

/**
 * Erro específico para quando ocorre um conflito com o estado atual do recurso
 */
export class ConflictError extends AppError {
  constructor(
    message = "Conflito com o estado atual do recurso.",
    errorCode = "CONFLICT",
    meta?: Record<string, any>
  ) {
    super(message, 409, errorCode, meta);
  }
}

/**
 * Erro específico para quando os dados da requisição são inválidos
 */
export class ValidationError extends AppError {
  /**
   * Erros detalhados de validação
   */
  public readonly errors: Record<string, string[]>;

  constructor(
    message = "Dados de entrada inválidos.",
    errors: Record<string, string[]> = {},
    errorCode = "VALIDATION_ERROR",
    meta?: Record<string, any>
  ) {
    super(message, 422, errorCode, meta);
    this.errors = errors;
  }

  /**
   * Sobrescreve o método para incluir erros de validação
   */
  public serialize(): Record<string, any> {
    return {
      ...super.serialize(),
      errors: this.errors,
    };
  }
}

/**
 * Erro específico para quando ocorre uma falha no servidor
 */
export class InternalServerError extends AppError {
  constructor(
    message = "Erro interno do servidor.",
    errorCode = "INTERNAL_SERVER_ERROR",
    meta?: Record<string, any>
  ) {
    super(message, 500, errorCode, meta);
  }
}

/**
 * Erro específico para quando um serviço externo falha
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Serviço temporariamente indisponível.",
    errorCode = "SERVICE_UNAVAILABLE",
    meta?: Record<string, any>
  ) {
    super(message, 503, errorCode, meta);
  }
}

/**
 * Erro específico para quando uma requisição é retornada muito rapidamente
 */
export class TooManyRequestsError extends AppError {
  constructor(
    message = "Muitas requisições. Por favor, tente novamente mais tarde.",
    errorCode = "TOO_MANY_REQUESTS",
    meta?: Record<string, any>
  ) {
    super(message, 429, errorCode, meta);
  }
}
