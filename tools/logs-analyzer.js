#!/usr/bin/env node

/**
 * Ferramenta de análise de logs
 * Permite visualizar, filtrar e analisar logs da aplicação
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Diretório de logs padrão
const DEFAULT_LOG_DIR = path.join(process.cwd(), "logs");

// Cores para terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

// Parâmetros da linha de comando
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    params[key] =
      args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
    if (params[key] !== true) i++;
  }
}

// Configurações
const config = {
  file: params.file || "app.log",
  type: params.type || null,
  level: params.level || null,
  search: params.search || null,
  user: params.user || null,
  from: params.from || null,
  to: params.to || null,
  limit: parseInt(params.limit || "1000"),
  tail: params.tail === "true" || params.tail === true,
  stats: params.stats === "true" || params.stats === true,
  logDir: params.dir || DEFAULT_LOG_DIR,
};

/**
 * Parseia uma linha de log para extrair informações
 */
function parseLogLine(line) {
  try {
    // Regex para extrair timestamp e nível de log
    const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/);
    if (!match) return null;

    const [, timestamp, level, message] = match;

    return {
      timestamp,
      level,
      message,
      raw: line,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Filtra uma linha de log conforme critérios especificados
 */
function filterLogLine(parsedLine) {
  if (!parsedLine) return false;

  // Filtro por nível
  if (config.level && parsedLine.level !== config.level) {
    return false;
  }

  // Filtro por termo de busca
  if (config.search && !parsedLine.raw.includes(config.search)) {
    return false;
  }

  // Filtro por usuário
  if (config.user && !parsedLine.raw.includes(`userId: ${config.user}`)) {
    return false;
  }

  // Filtro por data/hora inicial
  if (config.from) {
    const fromDate = new Date(config.from);
    const lineDate = new Date(parsedLine.timestamp);
    if (lineDate < fromDate) return false;
  }

  // Filtro por data/hora final
  if (config.to) {
    const toDate = new Date(config.to);
    const lineDate = new Date(parsedLine.timestamp);
    if (lineDate > toDate) return false;
  }

  return true;
}

/**
 * Formata uma linha de log para exibição no terminal
 */
function formatLogLine(parsedLine) {
  const levelColors = {
    INFO: colors.green,
    DEBUG: colors.blue,
    WARN: colors.yellow,
    ERROR: colors.red,
    AUDIT: colors.magenta,
    ACCESS: colors.cyan,
  };

  const color = levelColors[parsedLine.level] || colors.white;

  return `${colors.bright}${parsedLine.timestamp}${colors.reset} ${color}[${parsedLine.level}]${colors.reset} ${parsedLine.message}`;
}

/**
 * Processa arquivo de log com streaming
 */
async function processLogFile() {
  const filePath = path.join(config.logDir, config.file);

  // Verifica se o arquivo existe
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo de log não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`Analisando logs de: ${filePath}`);
  console.log(
    "Filtros aplicados:",
    Object.entries(config)
      .filter(
        ([key, value]) =>
          value !== null &&
          !["file", "logDir", "limit", "tail", "stats"].includes(key)
      )
      .map(([key, value]) => `${key}=${value}`)
      .join(", ") || "nenhum"
  );
  console.log("-------------------------------------");

  // Estatísticas
  const stats = {
    total: 0,
    filtered: 0,
    byLevel: {},
    errors: 0,
    warnings: 0,
    startTime: null,
    endTime: null,
  };

  // Interface de leitura de linha
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    output: process.stdout,
    terminal: false,
  });

  // Array para armazenar linhas (quando precisamos do limite)
  const lines = [];

  for await (const line of rl) {
    stats.total++;

    // Parseia a linha
    const parsedLine = parseLogLine(line);
    if (!parsedLine) continue;

    // Atualiza estatísticas de tempo
    const lineDate = new Date(parsedLine.timestamp);
    if (!stats.startTime || lineDate < stats.startTime) {
      stats.startTime = lineDate;
    }
    if (!stats.endTime || lineDate > stats.endTime) {
      stats.endTime = lineDate;
    }

    // Atualiza estatísticas por nível
    stats.byLevel[parsedLine.level] =
      (stats.byLevel[parsedLine.level] || 0) + 1;

    // Contadores específicos
    if (parsedLine.level === "ERROR") stats.errors++;
    if (parsedLine.level === "WARN") stats.warnings++;

    // Filtra a linha conforme critérios
    if (!filterLogLine(parsedLine)) continue;

    stats.filtered++;

    // Se não estamos apenas coletando estatísticas
    if (!config.stats) {
      if (config.tail) {
        // Modo tail: exibe as linhas à medida que são encontradas
        console.log(formatLogLine(parsedLine));
      } else {
        // Modo padrão: coleta linhas para exibir após a leitura
        lines.push(parsedLine);

        // Mantém apenas as linhas mais recentes conforme o limite
        if (lines.length > config.limit) {
          lines.shift();
        }
      }
    }
  }

  // Exibe as linhas coletadas (se não estiver no modo tail)
  if (!config.tail && !config.stats) {
    lines.forEach((line) => {
      console.log(formatLogLine(line));
    });

    if (stats.filtered > config.limit) {
      console.log(
        `\nExibindo ${config.limit} de ${stats.filtered} entradas filtradas.`
      );
    } else {
      console.log(`\nExibindo ${stats.filtered} entradas.`);
    }
  }

  // Exibe estatísticas
  if (config.stats) {
    console.log("\n=== Estatísticas dos Logs ===");
    console.log(
      `Período: ${stats.startTime?.toISOString()} até ${stats.endTime?.toISOString()}`
    );
    console.log(`Total de entradas: ${stats.total}`);
    console.log(`Entradas filtradas: ${stats.filtered}`);
    console.log("\nDistribuição por nível:");

    Object.entries(stats.byLevel).forEach(([level, count]) => {
      const percent = ((count / stats.total) * 100).toFixed(2);
      const levelColor =
        {
          INFO: colors.green,
          DEBUG: colors.blue,
          WARN: colors.yellow,
          ERROR: colors.red,
          AUDIT: colors.magenta,
          ACCESS: colors.cyan,
        }[level] || colors.white;

      console.log(
        `  ${levelColor}${level}${colors.reset}: ${count} (${percent}%)`
      );
    });

    console.log("\nErros e Avisos:");
    console.log(`  Erros: ${stats.errors}`);
    console.log(`  Avisos: ${stats.warnings}`);
  }
}

// Executa o processamento
processLogFile().catch((error) => {
  console.error("Erro ao processar logs:", error);
  process.exit(1);
});
