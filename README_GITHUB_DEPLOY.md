# Guia de Deploy Automático - Futgol (GitHub Actions)

Este guia explica como configurar o deploy automático para que, ao fazer um push no GitHub, o projeto seja atualizado na sua VPS.

## 1. Preparação no Servidor (VPS)

Acesse sua VPS e configure o repositório pela primeira vez:

```bash
# 1. Acesse a VPS
ssh root@SEU_IP_DA_VPS

# 2. Crie a pasta e entre nela
mkdir -p /var/www/futgol
cd /var/www/futgol

# 3. Gere uma chave SSH para o GitHub
# ATENÇÃO: Se você já tem outros projetos nessa VPS, veja a seção "Múltiplos Projetos" abaixo antes de rodar isso!
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_futgol

# 4. Exiba a chave pública e COPIE o conteúdo
cat ~/.ssh/id_futgol.pub
```

> **Ação:** Vá no seu repositório do GitHub -> Settings -> Deploy keys -> Add deploy key.
> Cole a chave, dê um título (ex: "VPS Futgol") e **não** precisa marcar "Allow write access".

### Configuração de Múltiplos Projetos (Importante)
Se você já tem outros projetos na VPS, você precisa "ensinar" a VPS a usar essa chave nova especificamente para o Futgol, senão ela tentará usar a chave antiga e o GitHub vai bloquear.

Crie ou edite o arquivo `config` do SSH:
```bash
nano ~/.ssh/config
```

Adicione este bloco ao final do arquivo:
```text

Host github-futgol
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_futgol
```
(Salve com Ctrl+O, Enter, e saia com Ctrl+X)

### 5. Clone o repositório usando o Alias
Agora precisamos clonar o repositório. **Atenção aqui:**
Como configuramos um "apelido" (`github-futgol`) no arquivo `config` acima, vamos usar esse apelido no lugar de `github.com`.

Isso "força" o git a usar a chave `id_futgol` que criamos, evitando conflitos com suas outras chaves.

**Comando Padrão (NÃO USE ESTE):**
`git clone git@github.com:SEU_USUARIO/SEU_REPO.git`

**Comando CORRETO (USE ESTE):**
Substitua `github.com` por `github-futgol`:

```bash
# (Ainda na VPS)
git clone git@github-futgol:SEU_USUARIO/SEU_REPO.git .
# Nota: O ponto final '.' é importante para clonar na pasta atual

# Crie o arquivo .env se necessário (opcional, se usar env vars no docker-compose)
# nano .env
```

## 2. Configuração no GitHub (Secrets)

Para que o GitHub Actions consiga acessar sua VPS, precisamos configurar as "Secrets".

1. Vá no seu repositório do GitHub -> Settings -> Secrets and variables -> Actions.
2. Clique em "New repository secret" e adicione as seguintes:

| Nome | Valor |
|------|-------|
| `VPS_HOST` | O IP da sua VPS (ex: `123.456.78.90`) |
| `VPS_USER` | O usuário da VPS (ex: `root`) |
| `VPS_SSH_KEY` | A **Chave Privada** SSH da sua VPS (não a que criamos acima, mas a que VOCÊ usa para acessar a VPS do seu computador). Se não tiver acesso à chave privada, você pode criar um par de chaves específico para o Actions e adicionar a pública no `authorized_keys` da VPS. |

**Dica para `VPS_SSH_KEY` (Chave de Acesso):**
É altamente recomendável criar uma chave específica para o GitHub Actions e guardá-la na sua pasta de usuário (não dentro de projetos), para organização e segurança.

**1. No seu computador local (Windows/Linux/Mac):**
Abra o terminal (Git Bash ou PowerShell).

Primeiro, garanta que a pasta `.ssh` existe:
```powershell
# PowerShell
mkdir $HOME/.ssh
```
*(Se der erro dizendo que já existe, tudo bem, pode ignorar).*

Agora gere a chave (usando o caminho completo para garantir):
```powershell
# Cria a chave na pasta .ssh do seu usuário
ssh-keygen -t ed25519 -C "github-actions-futgol" -f "C:\Users\User\.ssh\id_futgol_actions"
```

**2. Instale a chave na VPS:**
Você precisa autorizar essa nova chave na sua VPS. O jeito mais fácil é copiar o conteúdo da chave **pública** (`.pub`) para lá.

Exiba o conteúdo da chave pública:
```powershell
cat "C:\Users\User\.ssh\id_futgol_actions.pub"
```
Copie esse conteúdo.

Agora, acesse sua VPS e adicione ao arquivo de chaves autorizadas:
```bash
# Na VPS:
nano ~/.ssh/authorized_keys
# Cole o conteúdo no final do arquivo (em uma nova linha), salve e saia.
```

**3. No GitHub:**
Agora pegue a chave **privada** para colocar na Secret:
```powershell
# No seu computador local:
cat "C:\Users\User\.ssh\id_futgol_actions"
```
Copie TODO o conteúdo (incluindo `-----BEGIN...` e `...END-----`) e cole na Secret `VPS_SSH_KEY` do GitHub.

## 3. Rodando o Deploy

Agora, sempre que você fizer um commit e push para a branch `main`:

```bash
git add .
git commit -m "Novas alterações"
git push origin main
```

O GitHub Actions vai:
1. Acessar sua VPS.
2. Baixar o código novo (`git pull`).
3. Reconstruir e reiniciar os containers (`docker compose up -d --build`).

## Deploy Manual (Caso necessário)

Se o Actions falhar, você pode fazer manualmente:

```bash
ssh root@SEU_IP_DA_VPS
cd /var/www/futgol
git pull origin main
docker compose down
docker compose up -d --build
```
