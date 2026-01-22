#!/bin/bash

# Configurações (ALTERE AQUI)
VPS_USER="root"
VPS_IP="76.13.67.38"
PROJECT_DIR="/var/www/futgol"

echo "🚀 Iniciando deploy para $VPS_USER@$VPS_IP..."

# 1. Criar diretório no servidor (caso não exista)
echo "📁 Criando diretório remoto ($PROJECT_DIR)..."
ssh $VPS_USER@$VPS_IP "mkdir -p $PROJECT_DIR"

# 2. Copiar arquivos do projeto
echo "uploading files..."
# Copia pastas backend e frontend, e arquivos de configuração
scp -r backend frontend docker-compose.yml $VPS_USER@$VPS_IP:$PROJECT_DIR

# 3. Executar Docker Compose no servidor
echo "🐳 Construindo e subindo containers..."
ssh $VPS_USER@$VPS_IP "cd $PROJECT_DIR && docker compose down && docker compose up -d --build"

echo "✅ Deploy concluído! Acesse: http://$VPS_IP"
