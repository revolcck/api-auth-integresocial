import chalk from "chalk";
import path from "path";
import { format as formatDate } from "date-fns";
import { env } from "@/config/environment";

/**
 * Interface para status de conexões do servidor
 */
export interface ServerConnectionStatus {
  database?: boolean;
  redis?: boolean;
  databaseConnections?: number;
}

/**
 * Utilitário para exibir banner e informações do servidor
 */
export class ServerBannerUtils {
  /**
   * Exibe um banner aprimorado com informações do projeto
   */
  public static showBanner(connections: ServerConnectionStatus = {}): void {
    const packageJson = require(path.join(process.cwd(), "package.json"));
    const projectName = packageJson.name;
    const projectVersion = packageJson.version;

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
    console.log(titleStyle(`  🚀 ${projectName.toUpperCase()} `));
    console.log(valueStyle(`  ${projectVersion}`));
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
      const dependencies = packageJson.dependencies;
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
   * Gera um relatório periódico de status do servidor
   */
  public static generateStatusReport(): void {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const uptimeStr =
      days > 0
        ? `${days}d ${hours}h ${minutes}m`
        : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

    console.log(chalk.cyan("\n📊 Relatório de Status do Servidor"));
    console.log(chalk.white(`  → Uptime: ${uptimeStr}`));
    console.log(
      chalk.white(
        `  → Memória: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(
          memUsage.heapTotal /
          1024 /
          1024
        ).toFixed(2)}MB`
      )
    );

    // Informações adicionais podem ser adicionadas aqui
    console.log("");
  }
}
