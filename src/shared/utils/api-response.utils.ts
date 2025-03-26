import { Response } from "express";

/**
 * Opções para customização da resposta de sucesso
 */
export interface SuccessResponseOptions {
  /**
   * Mensagem de sucesso
   */
  message?: string;

  /**
   * Código de status HTTP (padrão: 200)
   */
  statusCode?: number;

  /**
   * Metadados adicionais
   */
  meta?: Record<string, any>;
}

/**
 * Opções para customização da resposta de erro
 */
export interface ErrorResponseOptions {
  /**
   * Código de erro
   */
  code?: string;

  /**
   * Código de status HTTP (padrão: 400)
   */
  statusCode?: number;

  /**
   * Erros detalhados por campo
   */
  errors?: Record<string, string[]>;

  /**
   * Metadados adicionais
   */
  meta?: Record<string, any>;
}

/**
 * Classe utilitária para padronização das respostas da API
 */
export class ApiResponse {
  /**
   * Envia uma resposta de sucesso padronizada
   *
   * @param res Objeto de resposta do Express
   * @param data Dados a serem incluídos na resposta
   * @param options Opções de customização da resposta
   */
  public static success(
    res: Response,
    data: any = null,
    options: SuccessResponseOptions = {}
  ): Response {
    const statusCode = options.statusCode || 200;

    const response: Record<string, any> = {
      status: "success",
      message: options.message || "Operação realizada com sucesso",
    };

    // Adiciona dados apenas se não forem nulos
    if (data !== null) {
      response.data = data;
    }

    // Adiciona metadados se fornecidos
    if (options.meta) {
      response.meta = options.meta;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Envia uma resposta de paginação padronizada
   *
   * @param res Objeto de resposta do Express
   * @param data Dados a serem incluídos na resposta
   * @param pagination Informações de paginação
   * @param options Opções de customização da resposta
   */
  public static paginated(
    res: Response,
    data: any[],
    pagination: {
      currentPage: number;
      itemsPerPage: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    },
    options: SuccessResponseOptions = {}
  ): Response {
    const statusCode = options.statusCode || 200;

    const response = {
      status: "success",
      message: options.message || "Operação realizada com sucesso",
      data,
      pagination,
      ...(options.meta ? { meta: options.meta } : {}),
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Envia uma resposta de erro padronizada
   *
   * @param res Objeto de resposta do Express
   * @param message Mensagem de erro
   * @param options Opções de customização da resposta
   */
  public static error(
    res: Response,
    message: string,
    options: ErrorResponseOptions = {}
  ): Response {
    const statusCode = options.statusCode || 400;

    const response: Record<string, any> = {
      status: "error",
      message,
      code: options.code || "ERROR",
    };

    // Adiciona erros detalhados se fornecidos
    if (options.errors) {
      response.errors = options.errors;
    }

    // Adiciona metadados se fornecidos
    if (options.meta) {
      response.meta = options.meta;
    }

    return res.status(statusCode).json(response);
  }
}
