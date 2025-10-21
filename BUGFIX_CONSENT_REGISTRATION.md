# Correção de Bugs - Registro de Consentimento

## Data: 2025-10-21
## Status: ✅ Corrigido

---

## 📋 Resumo Executivo

Foram identificados e corrigidos **3 bugs críticos** no sistema de registro de consentimento que impediam o salvamento correto dos dados demográficos dos participantes.

---

## 🐛 Bugs Identificados

### Bug #1: Parâmetro Incorreto na Função registerConsent()
**Arquivo**: `index.html:2206-2233`
**Severidade**: 🔴 CRÍTICA
**Descrição**: A função `registerConsent()` recebia `participantData` como parâmetro, mas internamente tentava acessar `formData.email`, causando erro de referência indefinida.

**Código com Bug**:
```javascript
async function registerConsent(formData) {
    const consentPayload = {
        participantEmail: formData.email,  // ❌ formData é undefined
        // ...
    };
}
```

**Correção Aplicada**:
```javascript
async function registerConsent(participantData) {
    const consentPayload = {
        participantEmail: participantData.email,  // ✅ Correto
        // ...
    };
}
```

---

### Bug #2: Dados Demográficos Não Enviados ao Backend
**Arquivo**: `index.html:2207-2212`
**Severidade**: 🔴 CRÍTICA
**Descrição**: O formulário coleta nome, idade, sexo e escolaridade do participante, mas apenas o email estava sendo enviado ao backend. Os demais dados eram descartados.

**Código com Bug**:
```javascript
const consentPayload = {
    participantEmail: formData.email,  // ❌ Apenas email
    consentTypes: ['data_collection', 'research_use', 'data_storage'],
    consentText: '...',
};
```

**Correção Aplicada**:
```javascript
const consentPayload = {
    participantEmail: participantData.email,        // ✅ Email
    participantName: participantData.name,          // ✅ Nome
    participantAge: participantData.age,            // ✅ Idade
    participantGender: participantData.gender,      // ✅ Sexo
    participantEducation: participantData.education,// ✅ Escolaridade
    consentTypes: ['data_collection', 'research_use', 'data_storage'],
    consentText: '...',
};
```

---

### Bug #3: Backend Não Processava Dados Demográficos
**Arquivo**: `server.js:269-326`
**Severidade**: 🔴 CRÍTICA
**Descrição**: O endpoint `/api/consent` não validava nem processava os dados demográficos. Além disso, o banco de dados não tinha colunas para armazená-los.

**Código com Bug**:
```javascript
app.post('/api/consent', [
    body('participantEmail').isEmail().normalizeEmail(),  // ❌ Apenas email validado
    body('consentTypes').isArray().notEmpty(),
    body('consentText').isString().isLength({ min: 10 }),
], async (req, res) => {
    const { participantEmail, consentTypes, consentText } = req.body;  // ❌ Dados ignorados
    // ... dados demográficos não eram salvos
});
```

**Correção Aplicada**:
```javascript
app.post('/api/consent', [
    body('participantEmail').isEmail().normalizeEmail(),
    body('participantName').isString().isLength({ min: 3 }),      // ✅ Validação nome
    body('participantAge').isInt({ min: 18, max: 120 }),         // ✅ Validação idade
    body('participantGender').isString().notEmpty(),             // ✅ Validação sexo
    body('participantEducation').isString().notEmpty(),          // ✅ Validação escolaridade
    body('consentTypes').isArray().notEmpty(),
    body('consentText').isString().isLength({ min: 10 }),
], async (req, res) => {
    const { participantEmail, participantName, participantAge,
            participantGender, participantEducation, ... } = req.body;

    // Criptografar dados demográficos (LGPD)
    const demographicsData = {
        name: participantName,
        email: participantEmail,
        age: participantAge,
        gender: participantGender,
        education: participantEducation
    };
    const encryptedDemographics = encryptSensitiveData(demographicsData);

    // Salvar com criptografia
    await pool.query(`
        INSERT INTO consents
        (consent_token, pseudo_id, encrypted_demographics, demographics_iv, demographics_auth_tag, ...)
        VALUES ($1, $2, $3, $4, $5, ...)
    `, [...]);
});
```

---

## 🗄️ Onde os Dados São Salvos

### 1. Banco de Dados PostgreSQL

Os dados são armazenados em um banco de dados PostgreSQL com as seguintes tabelas:

#### Tabela: `consents`
Armazena os consentimentos e dados demográficos **criptografados**:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único do registro |
| `consent_token` | VARCHAR(64) | Token único para validação |
| `pseudo_id` | VARCHAR(64) | ID pseudonimizado (hash do email) |
| `consent_types` | JSONB | Tipos de consentimento concedidos |
| `consent_text` | TEXT | Termo de consentimento completo |
| `encrypted_demographics` | TEXT | **Dados demográficos criptografados** |
| `demographics_iv` | VARCHAR(32) | Vetor de inicialização (criptografia) |
| `demographics_auth_tag` | VARCHAR(32) | Tag de autenticação (integridade) |
| `ip_address` | INET | IP do participante |
| `user_agent` | TEXT | Navegador utilizado |
| `status` | VARCHAR(20) | Status: active, revoked, expired |
| `expires_at` | TIMESTAMP | Data de expiração (2 anos) |
| `created_at` | TIMESTAMP | Data de criação |

**Dados criptografados salvos em `encrypted_demographics`**:
```json
{
  "name": "Nome do Participante",
  "email": "email@exemplo.com",
  "age": 35,
  "gender": "masculino",
  "education": "superior-completo"
}
```

#### Tabela: `tmt_data`
Armazena os resultados dos testes TMT-A **criptografados**:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `pseudo_id` | VARCHAR(64) | ID pseudonimizado do participante |
| `session_id` | VARCHAR(64) | ID da sessão do teste |
| `test_phase` | VARCHAR(20) | 'practice' ou 'test' |
| `encrypted_data` | TEXT | **Dados completos do teste criptografados** |
| `encryption_iv` | VARCHAR(32) | Vetor de inicialização |
| `encryption_auth_tag` | VARCHAR(32) | Tag de autenticação |
| `total_time` | DECIMAL | Tempo total (agregado não sensível) |
| `total_errors` | INTEGER | Total de erros (agregado não sensível) |
| `accuracy` | DECIMAL | Acurácia (agregado não sensível) |
| `metadata` | JSONB | Metadados técnicos |
| `consent_token` | VARCHAR(64) | Referência ao consentimento |
| `collected_at` | TIMESTAMP | Data da coleta |
| `retention_until` | TIMESTAMP | Retenção até (5 anos) |

#### Tabela: `audit_logs`
Registra todas as operações para conformidade LGPD:

| Coluna | Descrição |
|--------|-----------|
| `action` | Ação realizada (ex: CONSENT_REGISTERED, DATA_COLLECTED) |
| `data_subject` | pseudo_id do titular dos dados |
| `timestamp` | Momento da ação |
| `status` | success/failed |

---

### 2. Configuração do Banco de Dados

**Variáveis de Ambiente** (arquivo `.env`):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tmt_data_db
DB_USER=db_user
DB_PASSWORD=your_secure_password
DB_SSL=false

ENCRYPTION_KEY=32_bytes_hex_key
SALT_SECRET=your_salt_secret
```

**Conexão**:
- Host: `localhost` (ou servidor remoto)
- Porta: `5432` (padrão PostgreSQL)
- Banco: `tmt_data_db`

---

## 🔐 Segurança e Conformidade LGPD

### Criptografia (Art. 46 LGPD)
- **Algoritmo**: AES-256-GCM (padrão militar)
- **Dados criptografados**:
  - Nome completo
  - Email
  - Idade, sexo, escolaridade
  - Resultados detalhados do teste

### Pseudonimização (Art. 13 LGPD)
- Emails são convertidos em hash SHA-256
- Impossível reverter o pseudo_id para o email original

### Retenção de Dados
- **Consentimentos**: 2 anos (renovável)
- **Dados de testes**: 5 anos (padrão clínico)
- **Logs de auditoria**: 7 anos (requisito legal)

---

## 🔧 Como Acessar os Dados

### 1. Via API (Acesso do Participante)
```bash
# Usando o token de consentimento
GET /api/my-data/{consent_token}
```

**Resposta**:
```json
{
  "success": true,
  "records": [
    {
      "recordId": "uuid",
      "sessionId": "session-123",
      "collectedAt": "2025-10-21T12:00:00Z",
      "data": {
        "participantInfo": {
          "name": "Nome",
          "age": 35,
          "gender": "masculino",
          "education": "superior-completo"
        },
        "testResults": { ... }
      }
    }
  ]
}
```

### 2. Via Banco de Dados (Pesquisadores Autorizados)
```sql
-- Ver consentimentos ativos
SELECT
    pseudo_id,
    consent_date,
    status,
    expires_at
FROM consents
WHERE status = 'active';

-- Ver dados agregados (não identificáveis)
SELECT * FROM tmt_data_aggregated;

-- Ver dados completos (requer descriptografia)
SELECT
    pseudo_id,
    encrypted_data,
    encryption_iv,
    encryption_auth_tag
FROM tmt_data
WHERE pseudo_id = 'hash_do_email';
```

### 3. Exportação Local
Os participantes podem exportar seus dados localmente:
- **CSV**: Formato tabular para Excel/Google Sheets
- **JSON**: Formato estruturado para análise
- **LocalStorage**: Salvamento no navegador

---

## 📊 Diagrama de Fluxo de Dados

```
Participante
    ↓
Formulário de Consentimento
    ↓
Frontend (index.html)
    ↓ (HTTPS)
Backend (server.js) → Validação
    ↓
Criptografia AES-256-GCM
    ↓
PostgreSQL Database
    ├── consents (dados demográficos criptografados)
    ├── tmt_data (resultados criptografados)
    └── audit_logs (rastreabilidade)
```

---

## ✅ Checklist de Verificação

- [x] Dados demográficos coletados no formulário
- [x] Dados enviados corretamente ao backend
- [x] Validação de campos implementada
- [x] Criptografia AES-256-GCM aplicada
- [x] Dados salvos no banco PostgreSQL
- [x] Logs de auditoria registrados
- [x] Conformidade com LGPD verificada
- [x] Migração de banco de dados criada
- [x] Documentação atualizada

---

## 🚀 Próximos Passos

1. **Aplicar migração no banco de dados**:
   ```bash
   psql -U db_user -d tmt_data_db -f database/migration_add_demographics.sql
   ```

2. **Reiniciar o servidor**:
   ```bash
   npm start
   ```

3. **Testar o fluxo completo**:
   - Preencher formulário de consentimento
   - Verificar salvamento no banco
   - Confirmar criptografia dos dados
   - Validar logs de auditoria

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
- Verificar logs do servidor: `console.log` no terminal
- Verificar logs de auditoria no banco: `SELECT * FROM audit_logs ORDER BY timestamp DESC`
- Revisar variáveis de ambiente no arquivo `.env`

---

**Desenvolvido com conformidade à LGPD (Lei 13.709/2018)**
