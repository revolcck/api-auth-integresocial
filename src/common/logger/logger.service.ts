import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import { appConfig } from '../../config';

/**
 * Níveis de log compatíveis com NestJS e extensíveis
 */
export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

/**
 * Serviço de Logger personalizado com base nas necessidades do Integre Social
 *
 * Implementa a interface LoggerService do NestJS e adiciona funcionalidades extras
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;
  private config = appConfig();
  private readonly logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  };

  constructor(context?: string) {
    this.context = context;
  }

  /**
   * Define o contexto do logger
   */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  /**
   * Verifica se o nível de log atual permite o log requisitado
   */
  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.config.logging.level;
    return this.logLevels[level] <= this.logLevels[configLevel];
  }

  /**
   * Formata a mensagem de log com timestamp e contexto
   */
  private formatMessage(message: any, context?: string): string {
    const formattedContext = context || this.context;
    const contextStr = formattedContext ? `[${formattedContext}] ` : '';
    const timestamp = new Date().toISOString();

    return `${timestamp} ${contextStr}${message}`;
  }

  /**
   * Log de erro
   */
  error(message: any, trace?: string, context?: string): void {
    if (!this.shouldLog('error')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.error(`🔴 ERROR: ${formattedMessage}`);

    if (trace) {
      console.error(trace);
    }
  }

  /**
   * Log de aviso
   */
  warn(message: any, context?: string): void {
    if (!this.shouldLog('warn')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.warn(`🟠 WARN: ${formattedMessage}`);
  }

  /**
   * Log informativo
   */
  log(message: any, context?: string): void {
    if (!this.shouldLog('info')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.log(`🔵 INFO: ${formattedMessage}`);
  }

  /**
   * Log de depuração
   */
  debug(message: any, context?: string): void {
    if (!this.shouldLog('debug')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.debug(`🟢 DEBUG: ${formattedMessage}`);
  }

  /**
   * Log verboso para informações detalhadas
   */
  verbose(message: any, context?: string): void {
    if (!this.shouldLog('verbose')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.debug(`⚪ VERBOSE: ${formattedMessage}`);
  }

  /**
   * Log para requests HTTP
   */
  http(message: any, context?: string): void {
    if (!this.shouldLog('http')) return;

    const formattedMessage = this.formatMessage(message, context);
    console.log(`🟣 HTTP: ${formattedMessage}`);
  }
}
