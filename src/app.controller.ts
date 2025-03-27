import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  /**
   * Endpoint de health check
   * Não requer autenticação
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'integre-auth',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint de versão
   * Não requer autenticação
   */
  @Get('version')
  getVersion() {
    return {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
