#!/bin/bash

# Script de setup para o projeto Integre Auth

echo "🚀 Iniciando configuração do Integre Auth..."

# Verifica se o pnpm está instalado
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm não encontrado. Por favor, instale com: npm install -g pnpm"
    exit 1
fi

# Instala dependências
echo "📦 Instalando dependências..."
pnpm install

# Cria o arquivo .env se ele não existir
if [ ! -f .env ]; then
    echo "🔧 Criando arquivo .env a partir do exemplo..."
    cp .env.example .env
    echo "⚠️ Por favor, atualize os valores no arquivo .env conforme necessário."
fi

# Gera os tipos do Prisma
echo "🔄 Gerando cliente Prisma..."
pnpm db:generate

echo "✅ Configuração concluída! Agora você pode iniciar o projeto com:"
echo "   pnpm start:dev"