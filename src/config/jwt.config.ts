import { JwtModuleOptions } from '@nestjs/jwt';
import { appConfig } from './app.config';

export const jwtConfig = (): JwtModuleOptions => {
  const config = appConfig();

  return {
    secret: config.security.jwtSecret,
    signOptions: {
      expiresIn: config.security.jwtExpiration,
    },
  };
};
