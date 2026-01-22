# Guia de Deploy - Futgol (VPS Hostinger)

Este guia ajuda você a implantar o projeto Futgol em um servidor VPS (Ubuntu/Debian recomendado) usando Docker.

## Pré-requisitos na VPS

1. **Acesso SSH** ao servidor.
2. **Docker** e **Docker Compose** instalados.

Se o Docker não estiver instalado, rode este comando na VPS:
```bash
curl -fsSL https://get.docker.com | sh
```

## Como fazer o Deploy

### Opção 1: Automática (Linux/Mac/WSL)

1. Abra o arquivo `deploy.sh`.
2. Edite as variáveis `VPS_USER` e `VPS_IP` com seus dados.
   Exemplo:
   ```bash
   VPS_USER="root"
   VPS_IP="123.456.78.90"
   ```
3. Execute o script no seu terminal local:
   ```bash
   bash deploy.sh
   ```

### Opção 2: Manual (Windows PowerShell ou Terminal)

1. Copie os arquivos para o servidor:
   ```bash
   scp -r backend frontend docker-compose.yml root@SEU_IP_DA_VPS:~/futgol
   ```

2. Acesse o servidor:
   ```bash
   ssh root@SEU_IP_DA_VPS
   ```

3. Entre na pasta e suba os containers:
   ```bash
   cd ~/futgol
   docker compose up -d --build
   ```

## Verificando o Status

Para ver se tudo está rodando:
```bash
docker compose ps
```

Para ver os logs (caso algo dê errado):
```bash
docker compose logs -f
```

O site estará disponível em `http://SEU_IP_DA_VPS`.
