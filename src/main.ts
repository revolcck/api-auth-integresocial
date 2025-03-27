import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { appConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = appConfig();
  const logger = new Logger('Bootstrap');

  // Middlewares de segurança
  app.use(helmet());
  app.enableCors({
    origin: true, // Em produção, configure origens específicas
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });
  app.use(cookieParser());

  // Prefixo global de API
  app.setGlobalPrefix('api');

  // Configurações adicionais do NestJS
  app.enableShutdownHooks();

  // Iniciar servidor
  const port = config.app.port;
  await app.listen(port);

  logger.log(
    `🚀 Servidor iniciado na porta ${port} em ambiente ${config.app.environment}`,
  );
  logger.log(`🔐 Sistema de autenticação do Integre Social está rodando!`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error(`❌ Erro ao iniciar o servidor: ${err.message}`, err.stack);
  process.exit(1);
});
