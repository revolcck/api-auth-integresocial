import { z } from 'zod';

// Usando zod para validar as variáveis de ambiente
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('1h'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // App
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  APP_AUTH_DOMAIN: z.string().default('login.integresocial.cloud'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),
});

// Função para validar e exportar as configurações
export const validateConfig = () => {
  const config = envSchema.safeParse(process.env);

  if (!config.success) {
    console.error('❌ Invalid environment variables:', config.error.format());
    throw new Error('Invalid environment configuration');
  }

  return config.data;
};

// Exportar a configuração para uso no aplicativo
export const appConfig = () => ({
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION,
  },
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV,
    baseUrl: process.env.APP_BASE_URL,
    authDomain: process.env.APP_AUTH_DOMAIN,
  },
  logging: {
    level: process.env.LOG_LEVEL,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
});
