import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

/**
 * Pipe de validação usando Zod
 * Alternativa ao ValidationPipe do NestJS que usa class-validator
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      // Usa zod-validation-error para formatar mensagens de erro
      const validationError = fromZodError(error);

      throw new BadRequestException({
        message: validationError.message,
        errors: validationError.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }
  }
}

/**
 * Função para criar uma instância do pipe de validação Zod
 * @param schema Schema Zod para validação
 * @returns Instância do ZodValidationPipe
 */
export function ZodValidation<T extends ZodSchema>(schema: T) {
  return new ZodValidationPipe(schema);
}
