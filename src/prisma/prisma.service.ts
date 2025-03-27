import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Connected to database successfully');

    // Configuração de log para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Disconnected from database successfully');
  }

  // Método para trabalhar com transações
  async executeInTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (prisma) => {
      return callback(prisma as PrismaClient);
    });
  }

  // Método para criar um contexto de Prisma com um tenant específico
  createTenantContext(tenantId: string): PrismaClient {
    // No futuro, pode-se implementar filtros por tenant ou conexão com schema específico
    return this;
  }
}
