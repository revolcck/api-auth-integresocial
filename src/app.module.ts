import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { appConfig, validateConfig } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Módulo principal da aplicação
 * Define as importações globais e providers
 */
@Module({
  imports: [
    // Configuração centralizada com validação de env
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
      load: [appConfig],
    }),
    // Módulos da aplicação
    LoggerModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [
    // Filtro global de exceções
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Interceptor de logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Interceptor de transformação de resposta
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
