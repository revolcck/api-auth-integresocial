import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { LoggerService } from './common/logger/logger.service';
import { setupSecurityMiddleware } from './common/middleware/security.middleware';

/**
 * Função principal para bootstrap da aplicação
 */
async function bootstrap() {
  // Criar instância da aplicação
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Obter configurações da aplicação
  const config = appConfig();

  // Configurar logger personalizado com resolve() ao invés de get()
  const logger = await app.resolve(LoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  // Configurar middlewares de segurança
  setupSecurityMiddleware(app);

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
  logger.log(`🌐 URL da aplicação: ${await app.getUrl()}`);
}

/**
 * Iniciar aplicação com tratamento de erro
 */
bootstrap().catch((err: Error) => {
  // Usar logger nativo do NestJS para o caso de erro durante o bootstrap
  // pois nosso LoggerService pode não estar disponível
  console.error(`❌ Erro ao iniciar o servidor: ${err.message}`, err.stack);
  process.exit(1);
});
