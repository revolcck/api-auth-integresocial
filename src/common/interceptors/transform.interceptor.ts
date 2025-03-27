import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse } from 'express';

/**
 * Interface para resposta padronizada da API
 */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
  success: boolean;
}

/**
 * Tipo para verificação de cabeçalhos especiais
 */
interface SpecialCaseHeader {
  header: string;
  value?: string;
  check?: (val: string) => boolean;
}

/**
 * Interceptor para transformar todas as respostas em um formato padronizado
 * Exceto para casos especiais como streaming de arquivos ou redirecionamentos
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    // Verifica se é uma resposta HTTP
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<ExpressResponse>();

    // Verifica cabeçalhos para identificar casos especiais
    const specialCases: SpecialCaseHeader[] = [
      { header: 'Content-Disposition', value: 'attachment' },
      { header: 'Location', check: (val: string) => !!val },
    ];

    // Se for um caso especial, não transforma a resposta
    for (const { header, value, check } of specialCases) {
      const headerValue = response.getHeader(header);
      if (
        headerValue &&
        (value
          ? typeof headerValue === 'string' && headerValue.includes(value)
          : check && typeof headerValue === 'string' && check(headerValue))
      ) {
        return next.handle();
      }
    }

    // Transforma a resposta no formato padronizado
    return next.handle().pipe(
      map((data: T | ApiResponse<T>) => {
        // Verifica se já está no formato padronizado
        if (
          data !== null &&
          typeof data === 'object' &&
          'data' in data &&
          'success' in data &&
          'timestamp' in data
        ) {
          return data;
        }

        // Formata a resposta no padrão desejado
        return {
          data,
          timestamp: new Date().toISOString(),
          success: true,
        } as ApiResponse<T>;
      }),
    );
  }
}
