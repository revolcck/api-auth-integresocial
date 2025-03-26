import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "@/shared/errors/AppError";
import { logger } from "@/shared/utils/logger.utils";

/**
 * Enum para definir quais partes da requisição devem ser validadas
 */
export enum ValidateSource {
  BODY = "body",
  QUERY = "query",
  PARAMS = "params",
  HEADERS = "headers",
}

/**
 * Interface para mapear os erros de validação do Joi para o formato da API
 */
interface JoiValidationErrors {
  [key: string]: string[];
}

/**
 * Opções para configurar o comportamento da validação
 */
export interface ValidationOptions {
  /**
   * Define se a validação deve continuar após encontrar o primeiro erro
   * @default false
   */
  abortEarly?: boolean;

  /**
   * Define se campos não definidos no schema devem ser permitidos
   * @default true
   */
  allowUnknown?: boolean;

  /**
   * Define se campos não definidos no schema devem ser removidos do objeto validado
   * @default true
   */
  stripUnknown?: boolean;

  /**
   * Define um erro personalizado para ser retornado em caso de falha na validação
   */
  errorMessage?: string;
}

/**
 * Configuração para validação de schemas em diferentes partes da requisição
 */
interface SchemaConfig {
  /**
   * Schema para validação do corpo da requisição
   */
  body?: Joi.Schema;

  /**
   * Schema para validação dos parâmetros de query
   */
  query?: Joi.Schema;

  /**
   * Schema para validação dos parâmetros de rota
   */
  params?: Joi.Schema;

  /**
   * Schema para validação dos cabeçalhos
   */
  headers?: Joi.Schema;
}

/**
 * Verifica se a propriedade é segura para modificar no objeto Request
 * @param source Fonte da requisição
 */
function isMutableProperty(source: ValidateSource): boolean {
  // Apenas body, query e params são seguros para modificar
  return [
    ValidateSource.BODY,
    ValidateSource.QUERY,
    ValidateSource.PARAMS,
  ].includes(source);
}

/**
 * Classe para validação de requisições HTTP
 */
export class ValidationMiddleware {
  /**
   * Factory para criar middleware de validação com um único schema
   *
   * @param schema Schema do Joi para validação
   * @param source Parte da requisição a ser validada (body, query, params, headers)
   * @param options Opções de configuração da validação
   */
  public static validate(
    schema: Joi.Schema,
    source: ValidateSource = ValidateSource.BODY,
    options: ValidationOptions = {}
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validationOptions = this.getValidationOptions(options);

        // Obtém os dados a serem validados com base na fonte especificada
        const data = req[source as keyof Request];

        // Executa a validação
        const { error, value } = schema.validate(data, validationOptions);

        // Se não houver erros, substitui os dados originais pelos validados
        if (!error) {
          // Apenas atualiza a propriedade se for seguro fazê-lo
          if (isMutableProperty(source)) {
            if (source === ValidateSource.BODY) {
              req.body = value;
            } else if (source === ValidateSource.QUERY) {
              req.query = value;
            } else if (source === ValidateSource.PARAMS) {
              req.params = value;
            }
          } else {
            // Para headers e outras propriedades somente leitura, apenas logamos
            logger.debug(
              `Validação bem-sucedida para ${source}, mas não é possível modificar esta propriedade`
            );
          }

          return next();
        }

        // Formata os erros e lança uma exceção de validação
        const validationError = this.formatValidationError(
          error,
          options.errorMessage
        );
        throw validationError;
      } catch (error) {
        // Se já é um ValidationError, passa adiante
        if (error instanceof ValidationError) {
          return next(error);
        }

        // Caso contrário, registra o erro e passa adiante
        logger.error("Erro durante validação de dados:", error);
        return next(error);
      }
    };
  }

  /**
   * Factory para criar middleware de validação com múltiplos schemas
   * Permite validar diferentes partes da requisição com schemas diferentes
   *
   * @param schemas Configuração de schemas para diferentes partes da requisição
   * @param options Opções de configuração da validação
   */
  public static validateMultiple(
    schemas: SchemaConfig,
    options: ValidationOptions = {}
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validationOptions = this.getValidationOptions(options);
        const validationErrors: JoiValidationErrors = {};
        let hasErrors = false;

        // Processa cada parte da requisição especificada
        if (schemas.body) {
          const { error, value } = schemas.body.validate(
            req.body,
            validationOptions
          );
          if (error) {
            this.collectErrors(error, validationErrors);
            hasErrors = true;
          } else {
            req.body = value;
          }
        }

        if (schemas.query) {
          const { error, value } = schemas.query.validate(
            req.query,
            validationOptions
          );
          if (error) {
            this.collectErrors(error, validationErrors);
            hasErrors = true;
          } else {
            req.query = value;
          }
        }

        if (schemas.params) {
          const { error, value } = schemas.params.validate(
            req.params,
            validationOptions
          );
          if (error) {
            this.collectErrors(error, validationErrors);
            hasErrors = true;
          } else {
            req.params = value;
          }
        }

        if (schemas.headers) {
          const { error } = schemas.headers.validate(
            req.headers,
            validationOptions
          );
          if (error) {
            this.collectErrors(error, validationErrors);
            hasErrors = true;
          }
          // Não podemos atribuir headers diretamente, pois é somente leitura
        }

        // Se houver erros, lança uma exceção de validação
        if (hasErrors) {
          const validationError = new ValidationError(
            options.errorMessage || "Dados de entrada inválidos",
            validationErrors,
            "VALIDATION_ERROR"
          );
          throw validationError;
        }

        // Continua para o próximo middleware
        return next();
      } catch (error) {
        // Se já é um ValidationError, passa adiante
        if (error instanceof ValidationError) {
          return next(error);
        }

        // Caso contrário, registra o erro e passa adiante
        logger.error("Erro durante validação de dados:", error);
        return next(error);
      }
    };
  }

  /**
   * Obtém as opções de validação com valores padrão
   */
  private static getValidationOptions(
    options: ValidationOptions
  ): Joi.ValidationOptions {
    return {
      abortEarly: options.abortEarly ?? false,
      allowUnknown: options.allowUnknown ?? true,
      stripUnknown: options.stripUnknown ?? true,
    };
  }

  /**
   * Formata o erro de validação do Joi para o formato da API
   */
  private static formatValidationError(
    error: Joi.ValidationError,
    customMessage?: string
  ): ValidationError {
    const formattedErrors: JoiValidationErrors = {};

    error.details.forEach((err) => {
      const key = err.path.join(".");

      if (!formattedErrors[key]) {
        formattedErrors[key] = [];
      }

      formattedErrors[key].push(err.message);
    });

    return new ValidationError(
      customMessage || "Dados de entrada inválidos",
      formattedErrors,
      "VALIDATION_ERROR"
    );
  }

  /**
   * Coleta os erros de validação em um objeto consolidado
   */
  private static collectErrors(
    error: Joi.ValidationError,
    errorsCollection: JoiValidationErrors
  ): void {
    error.details.forEach((err) => {
      const key = err.path.join(".");

      if (!errorsCollection[key]) {
        errorsCollection[key] = [];
      }

      errorsCollection[key].push(err.message);
    });
  }
}

// Exporta funções utilitárias para uso mais simples nas rotas
export const validate = ValidationMiddleware.validate;
export const validateMultiple = ValidationMiddleware.validateMultiple;
