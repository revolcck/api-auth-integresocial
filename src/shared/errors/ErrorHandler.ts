import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "./AppError";
import { logger } from "@/shared/utils/logger.utils";
import { env } from "@/config/environment";
import { ValidationError as JoiValidationError } from "joi";

/**
 * Interface para resposta de erro padronizada
 * Deve corresponder à estrutura retornada pelo método serialize() da classe AppError
 */
interface ErrorResponse {
  status: string;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
  meta?: Record<string, any>;
  stack?: string;
}

/**
 * Processa erros do Prisma e converte para AppError apropriado
 */
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError
): AppError => {
  // Mapeamento detalhado dos códigos de erro do Prisma
  const prismaErrorCodes: Record<string, () => AppError> = {
    // Unique constraint violation
    P2002: () => {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : (error.meta?.target as string) || "valor";

      return new ConflictError(
        `Já existe um registro com este ${target}.`,
        "UNIQUE_CONSTRAINT_VIOLATION",
        { fields: error.meta?.target }
      );
    },

    // Record not found
    P2025: () => {
      return new NotFoundError("Registro", "RECORD_NOT_FOUND", {
        details: error.meta?.cause,
      });
    },

    // Foreign key constraint failed
    P2003: () => {
      const fieldName = (error.meta?.field_name as string) || "campo";
      return new ValidationError(
        `Operação falhou devido a uma restrição de chave estrangeira: ${fieldName}`,
        {},
        "FOREIGN_KEY_CONSTRAINT",
        { field: fieldName }
      );
    },

    // Required relation violation
    P2014: () => {
      return new ValidationError(
        "Relacionamento obrigatório não encontrado.",
        {},
        "REQUIRED_RELATION",
        { details: error.meta }
      );
    },

    // Field does not exist in model
    P2009: () => {
      return new ValidationError(
        "Dados inválidos: um ou mais campos não existem no modelo.",
        {},
        "INVALID_FIELD",
        { details: error.meta }
      );
    },

    // Database query failed
    P2010: () => {
      return new InternalServerError(
        "Falha na consulta ao banco de dados.",
        "DATABASE_QUERY_FAILED",
        { details: env.isDevelopment ? error.meta : undefined }
      );
    },
  };

  // Se houver um handler específico para o código de erro, usa-o
  if (error.code in prismaErrorCodes) {
    return prismaErrorCodes[error.code]();
  }

  // Fallback para erros não mapeados explicitamente
  logger.error("Erro não mapeado do Prisma:", error);
  return new InternalServerError(
    "Erro ao processar operação no banco de dados.",
    "DATABASE_ERROR",
    env.isDevelopment ? { code: error.code, meta: error.meta } : undefined
  );
};

/**
 * Processa erros de validação do Joi
 */
const handleJoiError = (error: JoiValidationError): ValidationError => {
  const formattedErrors: Record<string, string[]> = {};

  error.details.forEach((detail) => {
    const path = detail.path.join(".");

    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }

    formattedErrors[path].push(detail.message);
  });

  return new ValidationError(
    "Dados de entrada inválidos.",
    formattedErrors,
    "VALIDATION_ERROR"
  );
};

/**
 * Classe para tratamento centralizado de erros
 */
export class ErrorHandler {
  /**
   * Middleware para tratamento de erros do Express
   */
  static handle(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    let processedError: AppError;

    // Identifica o tipo de erro e faz o tratamento adequado
    if (error instanceof AppError) {
      // Já é um AppError, mantém como está
      processedError = error;
    } else if (error instanceof JoiValidationError) {
      // Erro de validação do Joi
      processedError = handleJoiError(error);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Erro conhecido do Prisma
      processedError = handlePrismaError(error);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      // Erro de validação do Prisma (geralmente problema no código)
      logger.error("Erro de validação do Prisma:", error);
      processedError = new ValidationError(
        "Erro de validação na operação do banco de dados.",
        {},
        "PRISMA_VALIDATION_ERROR"
      );
    } else if (error.name === "SyntaxError") {
      // Erro de sintaxe JSON
      processedError = new ValidationError(
        "Sintaxe JSON inválida na requisição.",
        {},
        "INVALID_JSON"
      );
    } else {
      // Erro não tratado
      logger.error("Erro não tratado:", error);
      processedError = new InternalServerError(
        "Ocorreu um erro interno no servidor.",
        "INTERNAL_ERROR"
      );
    }

    // Logs adicionais em caso de erros 500
    if (processedError.statusCode >= 500) {
      logger.error(`Erro ${processedError.statusCode}:`, {
        error: processedError,
        request: {
          method: req.method,
          url: req.originalUrl,
          headers: this.getSafeHeaders(req),
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });
    }

    // Prepara a resposta de erro
    // Usamos uma conversão explícita para garantir compatibilidade com a interface
    const errorData = processedError.serialize();
    const errorResponse: ErrorResponse = {
      status: errorData.status,
      code: errorData.code,
      message: errorData.message,
      ...(errorData.errors && { errors: errorData.errors }),
      ...(errorData.meta && { meta: errorData.meta }),
    };

    // Adiciona stack trace em ambiente de desenvolvimento
    if (env.isDevelopment) {
      errorResponse.stack = processedError.stack;
    }

    // Envia a resposta de erro
    res.status(processedError.statusCode).json(errorResponse);
  }

  /**
   * Obtém headers seguros para logging (sem informações sensíveis)
   */
  private static getSafeHeaders(req: Request): Record<string, string> {
    const safeHeaders: Record<string, string> = {};
    const sensitiveHeaders = ["authorization", "cookie", "proxy-authorization"];

    Object.keys(req.headers).forEach((key) => {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        safeHeaders[key] = req.headers[key] as string;
      } else {
        safeHeaders[key] = "[REDACTED]";
      }
    });

    return safeHeaders;
  }
}
