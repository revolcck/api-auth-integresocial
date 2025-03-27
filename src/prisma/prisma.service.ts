import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Serviço Prisma para acesso ao banco de dados
 * Implementa hooks de ciclo de vida do NestJS
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly logger: LoggerService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    this.logger.setContext('PrismaService');
    this.setupLogging();
  }

  /**
   * Configurar logging de queries e eventos do Prisma
   */
  private setupLogging() {
    // Log de queries apenas em desenvolvimento e debug
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.LOG_LEVEL === 'debug'
    ) {
      this.$on('query' as any, (e: any) => {
        this.logger.debug(
          `Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`,
        );
      });
    }

    // Log de informações
    this.$on('info' as any, (e: any) => {
      this.logger.log(`${e.message}`);
    });

    // Log de avisos
    this.$on('warn' as any, (e: any) => {
      this.logger.warn(`${e.message}`);
    });

    // Log de erros
    this.$on('error' as any, (e: any) => {
      this.logger.error(`${e.message}`, e.target);
    });
  }

  /**
   * Hook de inicialização do módulo
   * Conecta ao banco de dados quando o módulo é inicializado
   */
  async onModuleInit() {
    try {
      this.logger.log('Conectando ao banco de dados...');
      await this.$connect();
      this.logger.log('Conexão com o banco de dados estabelecida com sucesso!');
    } catch (error) {
      this.logger.error('Falha ao conectar ao banco de dados', error.stack);
      throw error;
    }
  }

  /**
   * Hook de destruição do módulo
   * Desconecta do banco de dados quando o módulo é destruído
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Desconectando do banco de dados...');
      await this.$disconnect();
      this.logger.log('Desconexão do banco de dados realizada com sucesso!');
    } catch (error) {
      this.logger.error('Erro ao desconectar do banco de dados', error.stack);
    }
  }

  /**
   * Método de limpeza do banco para testes
   * ATENÇÃO: Deve ser usado APENAS em ambiente de testes
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'cleanDatabase só pode ser executado em ambiente de testes',
      );
    }

    // Executar truncate em todas as tabelas relevantes
    // A ordem é importante devido às constraints de foreign key
    const models = Reflect.ownKeys(this).filter((key) => {
      return (
        typeof key === 'string' &&
        !key.startsWith('_') &&
        key !== '$connect' &&
        key !== '$disconnect'
      );
    });

    return await this.$transaction([
      // Adicione aqui consultas para truncar tabelas específicas
      // Exemplo: this.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE;'),
    ]);
  }
}
