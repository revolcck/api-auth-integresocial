import { validateEnv } from './env.validation';

/**
 * Configuração completa da aplicação
 */
export function appConfig() {
  // Valida as variáveis de ambiente
  const env = validateEnv(process.env);

  return {
    app: {
      port: env.PORT,
      baseUrl: env.APP_BASE_URL,
      authDomain: env.APP_AUTH_DOMAIN,
      environment: env.NODE_ENV,
      isDevelopment: env.NODE_ENV === 'development',
      isProduction: env.NODE_ENV === 'production',
      isTest: env.NODE_ENV === 'test',
    },
    database: {
      url: env.DATABASE_URL,
    },
    security: {
      jwtSecret: env.JWT_SECRET,
      jwtExpiration: env.JWT_EXPIRATION,
      jwtRefreshExpiration: env.JWT_REFRESH_EXPIRATION,
      encryptionKey: env.ENCRYPTION_KEY,
    },
    logging: {
      level: env.LOG_LEVEL,
    },
    // Usado para validação das variáveis de ambiente no bootstrap do ConfigModule
    validationSchema: validateEnv,
  };
}

/**
 * Função de validação para usar com ConfigModule
 */
export function validateConfig(config: Record<string, unknown>) {
  return validateEnv(config);
}

// Exportação do tipo de configuração para uso em outros módulos
export type AppConfig = ReturnType<typeof appConfig>;
