import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

/**
 * Interface para resposta padronizada de erro
 */
interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  error?: string;
  stack?: string;
}

/**
 * Filtro global para tratar exceções HTTP
 * Formata as respostas de erro de forma padronizada e realiza o log
 */
@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determina o status code e mensagem baseado no tipo de exceção
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] =
      exception.message || 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const exceptionObj = exceptionResponse as Record<string, any>;
        message = exceptionObj.message || message;
        error = exceptionObj.error || error;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    }

    // Prepara a resposta de erro padronizada
    const errorResponse: ErrorResponse = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    };

    // Adiciona o stack trace em ambiente de desenvolvimento
    const config = process.env.NODE_ENV || 'development';
    if (config === 'development') {
      errorResponse.stack = exception.stack;
    }

    // Log do erro com diferentes níveis baseado no status code
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode} - ${message}`,
        exception.stack,
        'HttpException',
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${statusCode} - ${message}`,
        'HttpException',
      );
    }

    // Envia a resposta formatada
    response.status(statusCode).json(errorResponse);
  }
}
