import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Pipe de validação usando Zod
 * Alternativa ao ValidationPipe do NestJS que usa class-validator
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      // Usa zod-validation-error para formatar mensagens de erro
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);

        const details: ValidationErrorDetail[] = validationError.details.map(
          (detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          }),
        );

        throw new BadRequestException({
          message: validationError.message,
          errors: details,
        });
      }

      throw error;
    }
  }
}

/**
 * Função para criar uma instância do pipe de validação Zod
 * @param schema Schema Zod para validação
 * @returns Instância do ZodValidationPipe
 */
export function ZodValidation<T extends ZodSchema>(
  schema: T,
): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}
