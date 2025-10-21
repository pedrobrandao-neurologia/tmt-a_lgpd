# 🧠 TMT-A LGPD - Guia de Instalação e Deploy

## Trail Making Test - Part A com Backend LGPD-Compliant

Sistema completo para coleta de dados neuropsicológicos do TMT-A (Trail Making Test - Parte A) com conformidade total à LGPD (Lei Geral de Proteção de Dados).

---

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Instalação Local](#instalação-local-desenvolvimento)
- [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
- [Deploy em Produção](#deploy-em-produção)
- [Testes](#testes)
- [Manutenção](#manutenção)
- [Segurança](#segurança)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Pré-requisitos

### Software Necessário

- **Node.js**: versão 18+ ([Download](https://nodejs.org))
- **PostgreSQL**: versão 14+ ([Download](https://www.postgresql.org/download/))
- **Git**: para controle de versão
- **npm**: vem com Node.js

### Conhecimentos Recomendados

- Noções básicas de terminal/linha de comando
- Conceitos básicos de banco de dados
- (Opcional) Conhecimento em LGPD e conformidade de dados

---

## 💻 Instalação Local (Desenvolvimento)

### Passo 1: Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/tmt-a_lgpd.git
cd tmt-a_lgpd
```

### Passo 2: Instalar Dependências

```bash
npm install
```

### Passo 3: Configurar Banco de Dados PostgreSQL

#### 3.1. Criar Banco de Dados

```bash
# Acessar PostgreSQL
psql -U postgres

# No console do PostgreSQL:
CREATE DATABASE tmt_data_db;
CREATE USER db_user WITH ENCRYPTED PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE tmt_data_db TO db_user;
\q
```

#### 3.2. Executar Schema SQL

```bash
psql -U db_user -d tmt_data_db -f database/schema.sql
```

### Passo 4: Configurar Variáveis de Ambiente

#### 4.1. Gerar Chaves de Criptografia

```bash
# Gerar chave de criptografia (64 caracteres hex)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Gerar salt para pseudonimização (64 caracteres hex)
node -e "console.log('SALT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Gerar JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

#### 4.2. Criar Arquivo .env

```bash
cp .env.example .env
```

Edite o arquivo `.env` e preencha com os valores gerados acima:

```env
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Colar chaves geradas acima
ENCRYPTION_KEY=sua_chave_de_64_caracteres_aqui
SALT_SECRET=seu_salt_de_64_caracteres_aqui
JWT_SECRET=seu_jwt_secret_aqui

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tmt_data_db
DB_USER=db_user
DB_PASSWORD=sua_senha_segura
DB_SSL=false

JWT_EXPIRES_IN=24h

DATA_RETENTION_PERIOD=1825
LOG_RETENTION_PERIOD=2555

LOG_LEVEL=debug
```

### Passo 5: Executar o Servidor

```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm start
```

### Passo 6: Verificar Instalação

Abra o navegador em: `http://localhost:3000`

Verifique a saúde da API: `http://localhost:3000/api/health`

---

## 🗄️ Configuração do Banco de Dados

### Estrutura do Banco

O banco de dados possui 5 tabelas principais:

1. **consents**: Armazena consentimentos LGPD
2. **tmt_data**: Dados criptografados do TMT-A
3. **audit_logs**: Logs de auditoria (7 anos)
4. **researchers**: Pesquisadores autorizados
5. **data_subject_requests**: Solicitações dos titulares

### Verificar Instalação

```bash
psql -U db_user -d tmt_data_db

# No console do PostgreSQL:
\dt  # Listar tabelas
\d consents  # Ver estrutura da tabela consents
SELECT * FROM consents;  # Ver consentimentos (vazio inicialmente)
```

### Backup Manual

```bash
# Criar backup
pg_dump -U db_user tmt_data_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -U db_user -d tmt_data_db < backup_20250121.sql
```

---

## 🌐 Deploy em Produção

### Opção 1: Deploy no Heroku (Recomendado para Iniciantes)

```bash
# Instalar Heroku CLI
# macOS: brew install heroku/brew/heroku
# Windows: https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Criar aplicação
heroku create tmt-a-app-nome-unico

# Adicionar PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Configurar variáveis de ambiente
heroku config:set NODE_ENV=production
heroku config:set ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
heroku config:set SALT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
heroku config:set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
heroku config:set ALLOWED_ORIGINS=https://tmt-a-app-nome-unico.herokuapp.com

# Deploy
git add .
git commit -m "Deploy inicial"
git push heroku main

# Executar schema do banco
heroku pg:psql < database/schema.sql

# Ver logs
heroku logs --tail
```

### Opção 2: Deploy em VPS/AWS/Azure

Ver documentação detalhada em `docs/DEPLOY.md`

---

## 🧪 Testes

### Teste Local da API

```bash
# Teste de saúde
curl http://localhost:3000/api/health

# Teste de consentimento
curl -X POST http://localhost:3000/api/consent \
  -H "Content-Type: application/json" \
  -d '{
    "participantEmail": "teste@example.com",
    "consentTypes": ["data_collection", "data_processing"],
    "consentText": "Eu concordo com os termos...",
    "ipAddress": "127.0.0.1"
  }'
```

### Testes de Segurança

```bash
# Scan de vulnerabilidades
npm audit

# Teste de penetração básico (opcional)
npm install -g snyk
snyk test
```

---

## 🔧 Manutenção

### Rotinas Semanais

```sql
-- Verificar consentimentos expirados
SELECT check_expired_consents();
```

### Rotinas Mensais

```sql
-- Anonimizar dados antigos
SELECT anonymize_old_data();

-- Limpar logs antigos
SELECT delete_old_logs();
```

### Atualizar Dependências

```bash
npm outdated
npm update
```

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] **SSL/HTTPS** configurado em produção
- [ ] **Firewall** permitindo apenas portas necessárias
- [ ] **Backups** automáticos configurados
- [ ] **Logs de auditoria** sendo gravados
- [ ] **Rate limiting** ativo
- [ ] **CORS** configurado corretamente
- [ ] **Variáveis de ambiente** não versionadas
- [ ] **Chaves de criptografia** únicas e seguras

### Proteções Implementadas

- ✅ Criptografia AES-256-GCM para dados sensíveis
- ✅ Pseudonimização de identificadores pessoais
- ✅ Rate limiting (100 req/15min por IP)
- ✅ Helmet.js para headers de segurança
- ✅ Validação de entrada com express-validator
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS protection
- ✅ CORS configurado

---

## ⚠️ Troubleshooting

### Erro: "ECONNREFUSED" ao conectar ao banco

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Iniciar PostgreSQL
sudo systemctl start postgresql

# Verificar conexão
psql -U db_user -d tmt_data_db -h localhost
```

### Erro: "Invalid token" nas requisições

- Verificar se `JWT_SECRET` está configurado no `.env`
- Verificar se token não expirou
- Verificar formato do header: `Authorization: Bearer <token>`

### Erro: "Permission denied" ao criar tabelas

```bash
# Garantir permissões ao usuário
psql -U postgres -d tmt_data_db
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO db_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO db_user;
```

### Performance Lenta

```bash
# Verificar índices
psql -U db_user -d tmt_data_db
\di

# Analisar queries lentas
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### Backups Falhando

```bash
# Verificar permissões
ls -la database/backups/

# Verificar espaço em disco
df -h

# Testar backup manual
pg_dump -U db_user tmt_data_db > test_backup.sql
```

---

## 📞 Suporte

### Recursos

- **Documentação LGPD**: https://www.gov.br/anpd
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Node.js Security**: https://nodejs.org/en/docs/guides/security/
- **Express Best Practices**: https://expressjs.com/en/advanced/best-practice-security.html

### Reportar Problemas

Abra uma issue no GitHub: https://github.com/seu-usuario/tmt-a_lgpd/issues

---

## 📄 Licença

MIT License - Ver arquivo LICENSE para detalhes

---

## 👥 Contribuindo

Contribuições são bem-vindas! Por favor, leia CONTRIBUTING.md antes de submeter pull requests.

---

## 🎓 Citação

Se usar este projeto em pesquisa, por favor cite:

```
[Autor et al.]. (2025). TMT-A LGPD: Trail Making Test - Part A with LGPD Compliance.
GitHub repository: https://github.com/seu-usuario/tmt-a_lgpd
```

---

**Desenvolvido com ❤️ para pesquisa neuropsicológica ética e conforme à LGPD**
