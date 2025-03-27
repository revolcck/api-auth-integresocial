import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

/**
 * Interceptor para logging de requisições HTTP
 * Registra informações sobre a requisição e resposta, incluindo tempo de execução
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, ip, body } = request;
    const userAgent = request.get('user-agent') || 'unknown';

    // Obter ID do tenant (se disponível no futuro)
    const tenantId = (request as any).tenantId || 'unknown';

    // Mascarar dados sensíveis no body (se necessário)
    const safeBody = this.sanitizeBody(body);

    const startTime = Date.now();
    this.logger.http(
      `[Request] ${method} ${originalUrl} - Tenant: ${tenantId} - IP: ${ip} - UserAgent: ${userAgent}`,
    );

    if (Object.keys(safeBody).length > 0) {
      this.logger.debug(`Request body: ${JSON.stringify(safeBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          this.logResponse(context, startTime, data);
        },
        error: (error) => {
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.http(
            `[Response] ${method} ${originalUrl} - ${response.statusCode} - ${Date.now() - startTime}ms`,
          );
        },
      }),
    );
  }

  /**
   * Registra informações sobre a resposta
   */
  private logResponse(
    context: ExecutionContext,
    startTime: number,
    data: any,
  ): void {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const executionTime = Date.now() - startTime;

    this.logger.http(
      `[Response] ${method} ${originalUrl} - ${response.statusCode} - ${executionTime}ms`,
    );

    // Log condicional de corpo da resposta (apenas em debug)
    if (process.env.NODE_ENV === 'development' && data) {
      const responseBody = this.sanitizeResponse(data);
      this.logger.debug(
        `Response body: ${
          typeof responseBody === 'object'
            ? JSON.stringify(responseBody)
            : responseBody
        }`,
      );
    }
  }

  /**
   * Remove dados sensíveis do corpo da requisição
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sanitized = { ...body };

    // Lista de campos sensíveis para remover ou mascarar
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'authorization',
    ];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitiza dados sensíveis da resposta antes de logar
   */
  private sanitizeResponse(data: any): any {
    // Se não há dados ou não é um objeto, retorna como está
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Objetos grandes, apenas retorna um resumo
    if (JSON.stringify(data).length > 1000) {
      return '[Large response body]';
    }

    return data;
  }
}
