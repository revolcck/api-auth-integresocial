import { JwtModuleOptions } from '@nestjs/jwt';
import { appConfig } from './app.config';

export const jwtConfig: JwtModuleOptions = {
  secret: process.env.JWT_SECRET,
  signOptions: {
    expiresIn: process.env.JWT_EXPIRATION,
  },
};

// Configuração para JWT específico de tenant
export const createTenantJwtConfig = (tenant: string): JwtModuleOptions => {
  const config = appConfig();

  return {
    secret: `${config.jwt.secret}-${tenant}`,
    signOptions: {
      expiresIn: config.jwt.expiresIn,
      audience: tenant,
      issuer: config.app.authDomain,
    },
  };
};
