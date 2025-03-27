import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Interface para definir os eventos do Prisma
 */
interface PrismaEvent {
  query?: string;
  params?: string;
  duration?: number;
  message?: string;
  target?: string;
}

/**
 * Interface para o Prisma Client
 * Define os métodos e propriedades que usamos
 */
interface PrismaClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $on(event: string, callback: (event: PrismaEvent) => void): void;
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  $executeRawUnsafe(query: string, ...params: unknown[]): Promise<unknown>;

  // Modelos
  user: unknown;
  tenant: unknown;
  userTenant: unknown;
  role: unknown;
  plan: unknown;
  userSession: unknown;
}

/**
 * Interface para o construtor do PrismaClient
 */
interface PrismaClientConstructor {
  new (options?: unknown): PrismaClient;
}

/**
 * Serviço Prisma para acesso ao banco de dados
 * Implementa hooks de ciclo de vida do NestJS
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  // Instância do Prisma client com tipo mais específico
  private prisma!: PrismaClient;

  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('PrismaService');
    void this.initializePrismaClient();
  }

  /**
   * Inicializa o cliente Prisma dinamicamente
   */
  private async initializePrismaClient(): Promise<void> {
    try {
      // Import dinâmico do Prisma client
      const prismaModule = await import('@prisma/client');

      // Verificar se PrismaClient está disponível como exportação nomeada
      // e tipá-lo explicitamente como um construtor
      const PrismaClient = prismaModule.PrismaClient as PrismaClientConstructor;

      if (!PrismaClient) {
        throw new Error('PrismaClient não encontrado no módulo @prisma/client');
      }

      // Instanciar o PrismaClient com as opções de log
      this.prisma = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
      });

      this.setupLogging();
    } catch (error) {
      this.logger.error(
        'Falha ao inicializar o Prisma client',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Getters para acesso aos modelos do Prisma
   */
  get users(): unknown {
    return this.prisma.user;
  }

  get tenants(): unknown {
    return this.prisma.tenant;
  }

  get userTenants(): unknown {
    return this.prisma.userTenant;
  }

  get roles(): unknown {
    return this.prisma.role;
  }

  get plans(): unknown {
    return this.prisma.plan;
  }

  get userSessions(): unknown {
    return this.prisma.userSession;
  }

  /**
   * Configurar logging de queries e eventos do Prisma
   */
  private setupLogging(): void {
    // Log de queries apenas em desenvolvimento e debug
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.LOG_LEVEL === 'debug'
    ) {
      this.prisma.$on('query', (e: PrismaEvent) => {
        this.logger.debug(
          `Query: ${e.query || ''} - Params: ${e.params || ''} - Duration: ${e.duration || 0}ms`,
        );
      });
    }

    // Log de informações
    this.prisma.$on('info', (e: PrismaEvent) => {
      this.logger.log(`${e.message || '[No message]'}`);
    });

    // Log de avisos
    this.prisma.$on('warn', (e: PrismaEvent) => {
      this.logger.warn(`${e.message || '[No message]'}`);
    });

    // Log de erros
    this.prisma.$on('error', (e: PrismaEvent) => {
      this.logger.error(`${e.message || '[No message]'}`, e.target);
    });
  }

  /**
   * Hook de inicialização do módulo
   * Conecta ao banco de dados quando o módulo é inicializado
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Conectando ao banco de dados...');
      await this.prisma.$connect();
      this.logger.log('Conexão com o banco de dados estabelecida com sucesso!');
    } catch (error) {
      this.logger.error(
        'Falha ao conectar ao banco de dados',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Hook de destruição do módulo
   * Desconecta do banco de dados quando o módulo é destruído
   */
  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log('Desconectando do banco de dados...');
      await this.prisma.$disconnect();
      this.logger.log('Desconexão do banco de dados realizada com sucesso!');
    } catch (error) {
      this.logger.error(
        'Erro ao desconectar do banco de dados',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Método de limpeza do banco para testes
   * ATENÇÃO: Deve ser usado APENAS em ambiente de testes
   */
  async cleanDatabase(): Promise<unknown> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'cleanDatabase só pode ser executado em ambiente de testes',
      );
    }

    // Executar truncate em todas as tabelas relevantes
    // A ordem é importante devido às constraints de foreign key
    return this.prisma.$transaction([
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "user_sessions" CASCADE;'),
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "user_tenants" CASCADE;'),
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE;'),
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "tenants" CASCADE;'),
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "roles" CASCADE;'),
      this.prisma.$executeRawUnsafe('TRUNCATE TABLE "plans" CASCADE;'),
    ]);
  }

  /**
   * Método para executar queries SQL raw
   */
  async executeRaw(query: string, params?: unknown[]): Promise<unknown> {
    return this.prisma.$executeRawUnsafe(query, ...(params || []));
  }

  /**
   * Cria uma transação a partir de uma lista de operações
   */
  async transaction<T>(operations: Promise<T>[]): Promise<T[]> {
    return this.prisma.$transaction(operations);
  }
}
