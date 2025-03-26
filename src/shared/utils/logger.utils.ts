import fs from "fs";
import path from "path";
import { createWriteStream, WriteStream } from "fs";
import { format as formatDate } from "date-fns";
import { env } from "@/config/environment";
import chalk from "chalk";
import { inspect } from "util";

/**
 * Tipo que define os níveis de log disponíveis
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "audit" | "access";

/**
 * Interface para definir a configuração de cada nível de log
 */
interface LogLevelConfig {
  label: string;
  color: Function; // Usa Function em vez de typeof chalk.green
  console: boolean;
  file: boolean;
}

/**
 * Interface para definir campos de auditoria
 */
export interface AuditData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  ip?: string;
  statusCode?: number;
  method?: string;
  path?: string;
}

/**
 * Configuração dos níveis de log com suas cores e comportamentos
 */
const LOG_LEVELS: Record<LogLevel, LogLevelConfig> = {
  debug: {
    label: "DEBUG",
    color: chalk.cyan,
    console: env.isDevelopment,
    file: env.isDevelopment,
  },
  info: {
    label: "INFO",
    color: chalk.blue,
    console: true,
    file: true,
  },
  warn: {
    label: "WARN",
    color: chalk.yellow,
    console: true,
    file: true,
  },
  error: {
    label: "ERROR",
    color: chalk.red,
    console: true,
    file: true,
  },
  audit: {
    label: "AUDIT",
    color: chalk.magenta,
    console: env.isDevelopment,
    file: true, // Sempre gravamos audits em arquivo
  },
  access: {
    label: "ACCESS",
    color: chalk.green,
    console: env.isDevelopment,
    file: true,
  },
};

/**
 * Classe Logger que gerencia os logs da aplicação
 * Implementa o padrão Singleton para garantir uma única instância
 */
export class Logger {
  private static instance: Logger;
  private logDir: string;
  private streams: Map<string, WriteStream> = new Map();
  private readonly maxLogSize = 10 * 1024 * 1024; // 10MB
  private readonly maxLogFiles = 10;
  private readonly projectName: string;
  private readonly projectVersion: string;

  /**
   * Construtor privado para implementar o padrão Singleton
   */
  private constructor() {
    // Obtém nome e versão do projeto do package.json
    const packageJson = require(path.join(process.cwd(), "package.json"));
    this.projectName = packageJson.name;
    this.projectVersion = packageJson.version;

    this.logDir = path.join(process.cwd(), env.log.dir);
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Inicializa os streams de log
    this.initializeStreams();
  }

  /**
   * Obtém a instância única do Logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Inicializa os streams de arquivo para cada tipo de log
   */
  private initializeStreams(): void {
    const logTypes = ["app", "error", "audit", "access"];

    logTypes.forEach((type) => {
      const filePath = path.join(this.logDir, `${type}.log`);

      // Verifica se precisamos fazer rotação de logs
      this.checkRotation(filePath);

      const stream = createWriteStream(filePath, { flags: "a" });
      this.streams.set(type, stream);
    });
  }

  /**
   * Verifica se um arquivo de log precisa de rotação baseado no tamanho
   */
  private checkRotation(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);

        if (stats.size >= this.maxLogSize) {
          this.rotateLog(filePath);
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar rotação de logs: ${error}`);
    }
  }

  /**
   * Realiza rotação de arquivos de log
   */
  private rotateLog(filePath: string): void {
    const baseFileName = path.basename(filePath, ".log");
    const dirName = path.dirname(filePath);

    // Remove o arquivo mais antigo se atingiu o limite
    const oldestLogFile = path.join(
      dirName,
      `${baseFileName}.${this.maxLogFiles}.log`
    );

    if (fs.existsSync(oldestLogFile)) {
      fs.unlinkSync(oldestLogFile);
    }

    // Realiza a rotação dos arquivos existentes
    for (let i = this.maxLogFiles - 1; i >= 1; i--) {
      const oldFile = path.join(dirName, `${baseFileName}.${i}.log`);
      const newFile = path.join(dirName, `${baseFileName}.${i + 1}.log`);

      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
      }
    }

    // Renomeia o arquivo atual
    fs.renameSync(filePath, path.join(dirName, `${baseFileName}.1.log`));
  }

  /**
   * Formata uma mensagem de log com timestamp, nível e demais informações
   */
  private formatLogMessage(
    level: LogLevel,
    message: string,
    data?: any
  ): string {
    const timestamp = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss.SSS");
    const levelConfig = LOG_LEVELS[level];

    let formattedData = "";
    if (data) {
      if (typeof data === "object") {
        formattedData = inspect(data, {
          depth: 5,
          colors: false,
          compact: false,
        });
      } else {
        formattedData = String(data);
      }
    }

    return `[${timestamp}] [${levelConfig.label}] ${message}${
      formattedData ? `\n${formattedData}` : ""
    }`;
  }

  /**
   * Grava um log em arquivo e/ou exibe no console
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const levelConfig = LOG_LEVELS[level];
    const logMessage = this.formatLogMessage(level, message, data);

    // Exibe no console se configurado
    if (levelConfig.console) {
      console.log(levelConfig.color(`${logMessage}`));
    }

    // Grava em arquivo se configurado
    if (levelConfig.file) {
      let streamName = "app";

      if (level === "error") {
        streamName = "error";
      } else if (level === "audit") {
        streamName = "audit";
      } else if (level === "access") {
        streamName = "access";
      }

      const stream = this.streams.get(streamName);
      if (stream && stream.writable) {
        stream.write(`${logMessage}\n`);
      }
    }
  }

  /**
   * Exibe um banner com informações do projeto ao iniciar
   */
  public showBanner(
    connections: {
      database?: boolean;
      redis?: boolean;
      databaseConnections?: number;
    } = {}
  ): void {
    const envColor = env.isDevelopment
      ? chalk.yellow
      : env.isProduction
      ? chalk.green
      : chalk.blue;

    const dbStatus = connections.database
      ? chalk.green("✓ Conectado")
      : chalk.red("✗ Desconectado");

    const redisStatus = connections.redis
      ? chalk.green("✓ Conectado")
      : chalk.red("✗ Desconectado");

    const connectionInfo =
      connections.database && connections.databaseConnections
        ? `(${connections.databaseConnections} conexões)`
        : "";

    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    // Estilo e cores consistentes
    const titleStyle = chalk.cyan.bold;
    const sectionStyle = chalk.cyan;
    const labelStyle = chalk.dim;
    const valueStyle = chalk.white;
    const highlightStyle = chalk.cyan;
    const separatorLine = "  " + chalk.dim("─".repeat(50));

    console.log("\n");
    console.log(titleStyle(`  🚀 ${this.projectName.toUpperCase()} `));
    console.log(valueStyle(`  ${this.projectVersion}`));
    console.log(separatorLine);

    // Seção do Sistema
    console.log(sectionStyle("\n  📊 Sistema"));
    console.log(
      `  ${labelStyle("Node.js:")}     ${valueStyle(process.version)}`
    );
    console.log(`  ${labelStyle("Ambiente:")}    ${envColor(env.nodeEnv)}`);
    console.log(
      `  ${labelStyle("Porta:")}       ${valueStyle(env.port.toString())}`
    );
    console.log(
      `  ${labelStyle("Memória:")}     ${valueStyle(
        `${memoryUsedMB}MB / ${memoryTotalMB}MB`
      )} ${labelStyle("(utilizada/alocada)")}`
    );

    // Seção de Conexões
    console.log(sectionStyle("\n  🔌 Conexões"));
    console.log(
      `  ${labelStyle("Banco de Dados:")} ${dbStatus} ${
        connectionInfo ? highlightStyle(connectionInfo) : ""
      }`
    );
    console.log(`  ${labelStyle("Redis:")}         ${redisStatus}`);

    // Data de Início
    console.log(separatorLine);
    console.log(
      `  ${labelStyle("Iniciado em:")}  ${valueStyle(
        formatDate(new Date(), "dd/MM/yyyy HH:mm:ss")
      )}`
    );

    // Informações Técnicas
    if (env.isDevelopment) {
      console.log(sectionStyle("\n  🔧 Informações Técnicas"));
      console.log(
        `  ${labelStyle("PID:")}          ${valueStyle(process.pid.toString())}`
      );
      console.log(
        `  ${labelStyle("Plataforma:")}   ${valueStyle(process.platform)}`
      );
      console.log(
        `  ${labelStyle("Arquitetura:")}  ${valueStyle(process.arch)}`
      );

      console.log(sectionStyle("\n  📦 Dependências"));
      const dependencies = require(path.join(
        process.cwd(),
        "package.json"
      )).dependencies;
      const keyDeps = [
        "express",
        "@prisma/client",
        "jose",
        "joi",
        "bcryptjs",
        "redis",
      ];

      keyDeps.forEach((dep) => {
        if (dependencies[dep]) {
          console.log(
            `  ${labelStyle("•")} ${labelStyle(dep + ":")} ${valueStyle(
              dependencies[dep]
            )}`
          );
        }
      });
    }

    console.log("\n");
  }

  /**
   * Registra um log de acesso HTTP
   */
  public access(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ip?: string,
    userId?: string
  ): void {
    const message = `${method} ${path} ${statusCode} ${responseTime}ms`;
    const data = { userAgent, ip, userId };

    this.log("access", message, data);
  }

  /**
   * Registra uma operação de auditoria
   */
  public audit(data: AuditData): void {
    const { action, resource, resourceId, userId } = data;
    const message = `${action.toUpperCase()} ${resource}${
      resourceId ? ` (${resourceId})` : ""
    }`;

    this.log("audit", message, {
      userId,
      ...data,
    });
  }

  /**
   * Registra uma mensagem de debug
   */
  public debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }

  /**
   * Registra uma mensagem de informação
   */
  public info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  /**
   * Registra uma mensagem de aviso
   */
  public warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }

  /**
   * Registra uma mensagem de erro
   */
  public error(message: string, error?: Error | any): void {
    const errorData =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error;

    this.log("error", message, errorData);
  }

  /**
   * Fecha todos os streams de log ao encerrar a aplicação
   */
  public closeStreams(): void {
    this.streams.forEach((stream) => {
      stream.end();
    });
    this.streams.clear();
  }
}

// Exporta uma instância do Logger
export const logger = Logger.getInstance();

// Adaptador para integração com Morgan
export const morganMiddleware = () => {
  const format =
    ":method :url :status :res[content-length] - :response-time ms";
  const stream = {
    write: (message: string) => {
      const trimmedMessage = message.trim();
      if (env.isDevelopment) {
        logger.debug(`HTTP: ${trimmedMessage}`);
      }
    },
  };

  const morgan = require("morgan");
  return morgan(format, { stream });
};

// Middleware para logging de erros
export const errorLogger = (
  err: Error,
  req: any,
  res: any,
  next: any
): void => {
  logger.error(`${req.method} ${req.url} - Erro processando requisição`, err);
  next(err);
};

// Re-exportamos funções individuais para compatibilidade
export const {
  info: logInfo,
  error: logError,
  warn: logWarn,
  debug: logDebug,
} = logger;
