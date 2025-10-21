-- schema.sql - Estrutura do banco de dados PostgreSQL para dados TMT-A LGPD-compliant

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 1. TABELA DE CONSENTIMENTOS (LGPD Art. 8)
-- ========================================

CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consent_token VARCHAR(64) UNIQUE NOT NULL,
    pseudo_id VARCHAR(64) NOT NULL, -- ID pseudonimizado do participante

    -- Tipos de consentimento concedidos
    consent_types JSONB NOT NULL, -- ['data_collection', 'data_processing', 'data_storage', 'data_sharing']

    -- Texto completo do consentimento apresentado
    consent_text TEXT NOT NULL,

    -- Versão do termo de consentimento
    consent_version VARCHAR(10) DEFAULT '1.0',

    -- Dados de registro
    consent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET NOT NULL,
    user_agent TEXT,

    -- Controle de validade
    status VARCHAR(20) DEFAULT 'active', -- active, revoked, expired
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,

    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Índices para performance
    CONSTRAINT consent_status_check CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX idx_consents_pseudo_id ON consents(pseudo_id);
CREATE INDEX idx_consents_token ON consents(consent_token);
CREATE INDEX idx_consents_status ON consents(status);
CREATE INDEX idx_consents_expires_at ON consents(expires_at);

-- ========================================
-- 2. TABELA DE DADOS TMT-A
-- ========================================

CREATE TABLE tmt_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificação pseudonimizada
    pseudo_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64) NOT NULL,

    -- Tipo de teste
    test_type VARCHAR(50) DEFAULT 'TMT-A',
    test_phase VARCHAR(20) NOT NULL, -- 'practice' ou 'test'

    -- Dados criptografados (LGPD Art. 46)
    encrypted_data TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    encryption_auth_tag VARCHAR(32) NOT NULL,
    encryption_algorithm VARCHAR(20) DEFAULT 'aes-256-gcm',

    -- Resultados agregados (não sensíveis)
    total_time DECIMAL(10,3),
    total_errors INTEGER,
    accuracy DECIMAL(5,2),
    completed_numbers INTEGER,

    -- Metadados técnicos não sensíveis
    metadata JSONB, -- {browser, screen_resolution, device_type, etc}

    -- Referência ao consentimento
    consent_token VARCHAR(64) NOT NULL,

    -- Controle temporal
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Controle de retenção (LGPD Art. 15, 16)
    retention_until TIMESTAMP WITH TIME ZONE,
    anonymized_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Controle de qualidade
    data_quality_score DECIMAL(3,2), -- 0.00 a 1.00
    validation_status VARCHAR(20) DEFAULT 'pending', -- pending, validated, rejected

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Chaves estrangeiras
    FOREIGN KEY (consent_token) REFERENCES consents(consent_token) ON DELETE CASCADE
);

CREATE INDEX idx_tmt_data_pseudo_id ON tmt_data(pseudo_id);
CREATE INDEX idx_tmt_data_session ON tmt_data(session_id);
CREATE INDEX idx_tmt_data_test_phase ON tmt_data(test_phase);
CREATE INDEX idx_tmt_data_collected_at ON tmt_data(collected_at);
CREATE INDEX idx_tmt_data_retention ON tmt_data(retention_until);

-- ========================================
-- 3. TABELA DE AUDITORIA (LGPD Art. 37, 48)
-- ========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificação da ação
    action VARCHAR(50) NOT NULL, -- 'DATA_COLLECTED', 'DATA_ACCESSED', 'CONSENT_REVOKED', etc.

    -- Dados do acesso
    ip_address INET NOT NULL,
    user_agent TEXT,
    endpoint VARCHAR(255),

    -- Identificação do titular dos dados
    data_subject VARCHAR(64), -- pseudo_id ou identificador genérico

    -- Identificação do operador (pesquisador)
    user_id VARCHAR(50),
    user_role VARCHAR(30),

    -- Detalhes da operação
    request_data JSONB, -- Dados da requisição (sem informações sensíveis)
    response_status INTEGER,

    -- Resultado
    status VARCHAR(20) DEFAULT 'success', -- success, failed, blocked
    error_message TEXT,

    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Retenção de 7 anos (requisito legal comum para logs)
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 years')
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_data_subject ON audit_logs(data_subject);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- ========================================
-- 4. TABELA DE PESQUISADORES (OPERADORES)
-- ========================================

CREATE TABLE researchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Dados do pesquisador
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255),

    -- Credenciais (hash bcrypt)
    password_hash VARCHAR(255) NOT NULL,

    -- Controle de acesso (LGPD Art. 49)
    role VARCHAR(30) DEFAULT 'researcher', -- admin, researcher, analyst
    permissions JSONB, -- ['read_data', 'export_data', 'manage_consents']

    -- Treinamento em LGPD
    lgpd_training_completed BOOLEAN DEFAULT FALSE,
    lgpd_training_date TIMESTAMP WITH TIME ZONE,

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, inactive

    -- Controle
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_researchers_email ON researchers(email);

-- ========================================
-- 5. TABELA DE SOLICITAÇÕES DOS TITULARES (LGPD Art. 18)
-- ========================================

CREATE TABLE data_subject_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificação
    pseudo_id VARCHAR(64) NOT NULL,
    consent_token VARCHAR(64),

    -- Tipo de solicitação
    request_type VARCHAR(30) NOT NULL, -- 'access', 'correction', 'deletion', 'portability', 'revocation'

    -- Status
    status VARCHAR(30) DEFAULT 'pending', -- pending, in_progress, completed, rejected

    -- Detalhes
    request_details TEXT,
    response TEXT,

    -- Prazos legais (LGPD Art. 18, §3º - 15 dias)
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deadline TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 days'),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Responsável
    assigned_to UUID REFERENCES researchers(id)
);

CREATE INDEX idx_dsr_pseudo_id ON data_subject_requests(pseudo_id);
CREATE INDEX idx_dsr_status ON data_subject_requests(status);
CREATE INDEX idx_dsr_deadline ON data_subject_requests(deadline);

-- ========================================
-- 6. FUNÇÕES E TRIGGERS
-- ========================================

-- Atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_consents_updated_at
    BEFORE UPDATE ON consents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_researchers_updated_at
    BEFORE UPDATE ON researchers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Calcular data de retenção automaticamente
CREATE OR REPLACE FUNCTION set_retention_date()
RETURNS TRIGGER AS $$
BEGIN
    -- 5 anos de retenção padrão para dados clínicos
    NEW.retention_until := NEW.collected_at + INTERVAL '5 years';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tmt_data_retention
    BEFORE INSERT ON tmt_data
    FOR EACH ROW
    EXECUTE FUNCTION set_retention_date();

-- Verificar expiração de consentimentos
CREATE OR REPLACE FUNCTION check_expired_consents()
RETURNS void AS $$
BEGIN
    UPDATE consents
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. POLÍTICAS DE SEGURANÇA (Row-Level Security)
-- ========================================

-- Habilitar RLS nas tabelas sensíveis
ALTER TABLE tmt_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Nota: Políticas específicas devem ser criadas conforme necessidade da aplicação

-- ========================================
-- 8. VIEWS PARA ANÁLISE ANONIMIZADA
-- ========================================

-- View com dados agregados (não identificáveis)
CREATE VIEW tmt_data_aggregated AS
SELECT
    test_phase,
    DATE_TRUNC('month', collected_at) as collection_month,
    COUNT(*) as total_tests,
    AVG(total_time) as avg_time,
    AVG(total_errors) as avg_errors,
    AVG(accuracy) as avg_accuracy,
    MIN(total_time) as min_time,
    MAX(total_time) as max_time
FROM tmt_data
WHERE anonymized_at IS NULL
  AND deleted_at IS NULL
GROUP BY test_phase, DATE_TRUNC('month', collected_at);

-- View para dashboard de conformidade
CREATE VIEW lgpd_compliance_dashboard AS
SELECT
    'consents' as metric_type,
    status,
    COUNT(*) as count
FROM consents
GROUP BY status
UNION ALL
SELECT
    'data_subject_requests' as metric_type,
    status,
    COUNT(*) as count
FROM data_subject_requests
GROUP BY status;

-- ========================================
-- 9. JOBS DE MANUTENÇÃO (executar periodicamente)
-- ========================================

-- Anonimizar dados antigos
CREATE OR REPLACE FUNCTION anonymize_old_data()
RETURNS void AS $$
BEGIN
    UPDATE tmt_data
    SET
        anonymized_at = CURRENT_TIMESTAMP,
        encrypted_data = 'ANONYMIZED',
        encryption_iv = '',
        encryption_auth_tag = ''
    WHERE retention_until < CURRENT_TIMESTAMP
    AND anonymized_at IS NULL
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Deletar logs antigos
CREATE OR REPLACE FUNCTION delete_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs
    WHERE retention_until < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 10. COMENTÁRIOS E DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE consents IS 'Armazena todos os consentimentos com rastreabilidade completa (LGPD Art. 8)';
COMMENT ON TABLE tmt_data IS 'Dados do TMT-A criptografados com pseudonimização (LGPD Art. 46)';
COMMENT ON TABLE audit_logs IS 'Logs de auditoria para compliance e segurança (LGPD Art. 37, 48)';
COMMENT ON TABLE data_subject_requests IS 'Gerenciamento de solicitações dos titulares (LGPD Art. 18)';

COMMENT ON COLUMN tmt_data.encrypted_data IS 'Dados completos do teste criptografados com AES-256-GCM';
COMMENT ON COLUMN tmt_data.total_time IS 'Tempo total em segundos (agregado não sensível)';
COMMENT ON COLUMN tmt_data.retention_until IS 'Data limite para retenção dos dados (5 anos padrão)';
