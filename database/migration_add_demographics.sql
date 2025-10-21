-- Migration: Adicionar colunas de dados demográficos criptografados
-- Data: 2025-10-21
-- Descrição: Adiciona campos para armazenar dados demográficos dos participantes
--            de forma criptografada na tabela de consentimentos

-- Verificar se as colunas já existem antes de adicionar
DO $$
BEGIN
    -- Adicionar coluna encrypted_demographics se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consents'
        AND column_name = 'encrypted_demographics'
    ) THEN
        ALTER TABLE consents ADD COLUMN encrypted_demographics TEXT;
        RAISE NOTICE 'Coluna encrypted_demographics adicionada';
    ELSE
        RAISE NOTICE 'Coluna encrypted_demographics já existe';
    END IF;

    -- Adicionar coluna demographics_iv se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consents'
        AND column_name = 'demographics_iv'
    ) THEN
        ALTER TABLE consents ADD COLUMN demographics_iv VARCHAR(32);
        RAISE NOTICE 'Coluna demographics_iv adicionada';
    ELSE
        RAISE NOTICE 'Coluna demographics_iv já existe';
    END IF;

    -- Adicionar coluna demographics_auth_tag se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consents'
        AND column_name = 'demographics_auth_tag'
    ) THEN
        ALTER TABLE consents ADD COLUMN demographics_auth_tag VARCHAR(32);
        RAISE NOTICE 'Coluna demographics_auth_tag adicionada';
    ELSE
        RAISE NOTICE 'Coluna demographics_auth_tag já existe';
    END IF;
END $$;

-- Adicionar comentário explicativo
COMMENT ON COLUMN consents.encrypted_demographics IS 'Dados demográficos do participante criptografados (nome, email, idade, sexo, escolaridade) - LGPD Art. 46';
COMMENT ON COLUMN consents.demographics_iv IS 'Vetor de inicialização para criptografia AES-256-GCM dos dados demográficos';
COMMENT ON COLUMN consents.demographics_auth_tag IS 'Tag de autenticação para validação da integridade dos dados criptografados';

-- Log da migração
INSERT INTO audit_logs (action, ip_address, user_agent, endpoint, user_role, status)
VALUES (
    'DATABASE_MIGRATION_DEMOGRAPHICS',
    '127.0.0.1',
    'PostgreSQL Migration Script',
    'database/migration_add_demographics.sql',
    'admin',
    'success'
)
ON CONFLICT DO NOTHING;

SELECT 'Migração concluída com sucesso!' AS status;
