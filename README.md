# 🧠 TMT-A LGPD

## Trail Making Test - Part A com Conformidade LGPD

Sistema completo para coleta de dados neuropsicológicos do **TMT-A (Trail Making Test - Parte A)** com total conformidade à **LGPD** (Lei Geral de Proteção de Dados - Lei 13.709/2018).

---

## 📌 Sobre o Projeto

Este projeto fornece uma implementação digital profissional do TMT-A, um teste neuropsicológico amplamente utilizado para avaliar:

- ✅ Atenção sustentada
- ✅ Velocidade de processamento
- ✅ Funções executivas básicas
- ✅ Busca visual
- ✅ Coordenação motora

### 🔒 Conformidade LGPD

O sistema foi desenvolvido desde o início com foco em **privacidade e proteção de dados**:

- **Art. 7 e 8**: Consentimento explícito e informado
- **Art. 11**: Tratamento adequado de dados sensíveis de saúde
- **Art. 18**: Direitos dos titulares (acesso, correção, exclusão, portabilidade)
- **Art. 46**: Segurança e criptografia de dados
- **Art. 48**: Notificação de incidentes
- **Art. 37**: Logs de auditoria

---

## ✨ Funcionalidades

### Frontend (Interface do Teste)

- ✅ Interface responsiva e acessível
- ✅ Aquecimento antes do teste principal
- ✅ 25 números com posicionamento aleatório
- ✅ Detecção de erros em tempo real
- ✅ Feedback visual e sonoro
- ✅ Métricas detalhadas de desempenho
- ✅ Comparação com dados normativos
- ✅ Exportação de resultados (CSV, JSON)

### Backend LGPD-Compliant

- ✅ **Consentimento**: Registro rastreável de consentimentos
- ✅ **Pseudonimização**: Separação de dados identificáveis
- ✅ **Criptografia**: AES-256-GCM para dados sensíveis
- ✅ **Auditoria**: Logs completos de todas as operações
- ✅ **Direitos dos Titulares**: API para acesso, exclusão e portabilidade
- ✅ **Retenção**: Controle automático de período de retenção
- ✅ **Segurança**: Rate limiting, CORS, Helmet.js

### Métricas Coletadas

- ⏱️ Tempo total de execução
- 🎯 Acurácia e erros
- 📊 Tempo de reação médio, mínimo e máximo
- 📈 Variabilidade de desempenho (CV)
- 🔄 Análise de fadiga (velocidade inicial vs. final)
- 🚫 Classificação de erros (repetição, antecipação, sequência)

---

## 🚀 Início Rápido

### Instalação Local

```bash
# 1. Clonar repositório
git clone https://github.com/pedrobrandao-neurologia/tmt-a_lgpd.git
cd tmt-a_lgpd

# 2. Instalar dependências
npm install

# 3. Configurar banco de dados PostgreSQL
psql -U postgres
CREATE DATABASE tmt_data_db;
CREATE USER db_user WITH ENCRYPTED PASSWORD 'sua_senha';
GRANT ALL PRIVILEGES ON DATABASE tmt_data_db TO db_user;
\q

# 4. Executar schema
psql -U db_user -d tmt_data_db -f database/schema.sql

# 5. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 6. Gerar chaves de criptografia
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copiar para ENCRYPTION_KEY e SALT_SECRET no .env

# 7. Iniciar servidor
npm start
```

Acesse: `http://localhost:3000`

### Deploy em Produção

Ver guia completo em [`README-INSTALL.md`](./README-INSTALL.md)

---

## 📁 Estrutura do Projeto

```
tmt-a_lgpd/
├── index.html              # Interface do teste TMT-A
├── server.js               # Backend Node.js LGPD-compliant
├── package.json            # Dependências do projeto
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore              # Arquivos ignorados pelo git
├── database/
│   └── schema.sql          # Estrutura do banco de dados
├── docs/
│   └── LGPD-COMPLIANCE.md  # Documentação de conformidade
├── README.md               # Este arquivo
└── README-INSTALL.md       # Guia de instalação detalhado
```

---

## 🔐 Segurança e Privacidade

### Fluxo de Dados

```
1. Participante acessa o teste
   ↓
2. Consentimento LGPD apresentado
   ↓
3. Aceite registrado com timestamp e IP
   ↓
4. Token de consentimento gerado
   ↓
5. Teste realizado
   ↓
6. Dados criptografados com AES-256-GCM
   ↓
7. ID pseudonimizado (hash irreversível)
   ↓
8. Armazenamento seguro no PostgreSQL
   ↓
9. Log de auditoria registrado
```

### Camadas de Proteção

| Camada | Tecnologia | Finalidade |
|--------|-----------|-----------|
| Transporte | TLS 1.3 | Criptografia em trânsito |
| Aplicação | Helmet.js | Headers de segurança |
| Dados | AES-256-GCM | Criptografia em repouso |
| Identidade | SHA-256 | Pseudonimização |
| Acesso | Rate Limiting | Proteção contra abuse |
| Validação | express-validator | Sanitização de entrada |

---

## 📊 Dados Normativos

O sistema inclui dados normativos por faixa etária baseados em estudos de Tombaugh (2004):

- 18-24 anos: média 22.93s (DP 6.87)
- 25-34 anos: média 24.40s (DP 8.71)
- 35-44 anos: média 28.54s (DP 10.09)
- 45-54 anos: média 31.78s (DP 9.93)
- ... (até 85-89 anos)

---

## 📚 Documentação

- [Guia de Instalação](./README-INSTALL.md) - Instalação passo a passo
- [Conformidade LGPD](./docs/LGPD-COMPLIANCE.md) - Checklist completo

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT.

---

## 👥 Autores

- **Equipe de Neuropsicologia** - Desenvolvimento inicial

---

## 📞 Contato

**Encarregado de Dados (DPO)**
- Email: dpo@instituicao.edu.br

Para questões técnicas, abra uma issue no GitHub.

---

**Desenvolvido com ❤️ para pesquisa neuropsicológica ética e conforme à LGPD**
