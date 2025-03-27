import { JwtModuleOptions } from '@nestjs/jwt';
import { appConfig } from './app.config';

/**
 * Configuração do módulo JWT
 * Este arquivo é apenas uma preparação para implementação futura do módulo de autenticação
 */
export const jwtConfig = (): JwtModuleOptions => {
  const config = appConfig();

  return {
    secret: config.security.jwtSecret,
    signOptions: {
      expiresIn: config.security.jwtExpiration,
    },
  };
};
