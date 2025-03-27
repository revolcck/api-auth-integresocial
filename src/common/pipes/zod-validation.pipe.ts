import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      // Usando zod-validation-error para formatar mensagens de erro de maneira amigável
      const validationError = fromZodError(error);
      throw new BadRequestException({
        message: 'Erro de validação',
        errors: validationError.details,
      });
    }
  }
}
