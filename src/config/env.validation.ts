import { z } from 'zod';

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),

  // JWT (preparado para implementação futura)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRATION: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      'JWT_EXPIRATION deve estar no formato: 1s, 1m, 1h, 1d',
    ),
  JWT_REFRESH_EXPIRATION: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      'JWT_REFRESH_EXPIRATION deve estar no formato: 1s, 1m, 1h, 1d',
    ),

  // App
  PORT: z.string().regex(/^\d+$/).transform(Number),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_BASE_URL: z.string().url('APP_BASE_URL deve ser uma URL válida'),
  APP_AUTH_DOMAIN: z.string().min(1, 'APP_AUTH_DOMAIN é obrigatório'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),

  // Encryption (para dados sensíveis)
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY deve ter no mínimo 32 caracteres'),
});

/**
 * Interface tipada para as variáveis de ambiente
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Função para validar o env e retornar com tipagem
 * @param config Objeto com as variáveis de ambiente
 * @returns Objeto com as variáveis de ambiente validadas e tipadas
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  try {
    return envSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map((err) => {
          return `${err.path.join('.')}: ${err.message}`;
        })
        .join('\n');
      throw new Error(
        `Erro de validação nas variáveis de ambiente:\n${formattedErrors}`,
      );
    }
    throw error;
  }
}
