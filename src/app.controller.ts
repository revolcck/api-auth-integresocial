import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      service: 'integre-auth',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('version')
  getVersion() {
    return {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
