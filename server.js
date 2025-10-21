// server.js - Backend para coleta de dados TMT-A com conformidade LGPD

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();

// ========================================
// 1. CONFIGURAÇÃO DO BANCO DE DADOS
// ========================================

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tmt_data_db',
    user: process.env.DB_USER || 'db_user',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Erro inesperado no pool de conexões', err);
    process.exit(-1);
});

// ========================================
// 2. SEGURANÇA E MIDDLEWARES ESSENCIAIS
// ========================================

// Helmet para headers de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configurado para domínios específicos
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'];
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requisições sem origin (Postman, apps mobile, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Consent-Token'],
    credentials: true,
    maxAge: 600
};
app.use(cors(corsOptions));

// Rate limiting (LGPD Art. 46 - segurança)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requisições por IP
    message: 'Muitas requisições deste IP, tente novamente mais tarde',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Parse JSON com limite de tamanho
app.use(express.json({ limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// ========================================
// 3. SISTEMA DE LOGS DE AUDITORIA (LGPD Art. 37, 48)
// ========================================

async function logDataAccess(req, action, dataSubject = null, status = 'success', errorMessage = null) {
    const logEntry = {
        action: action,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        endpoint: req.originalUrl,
        data_subject: dataSubject,
        user_id: req.user?.id || 'anonymous',
        user_role: req.user?.role || 'participant',
        request_data: JSON.stringify({
            method: req.method,
            params: req.params,
            query: req.query
        }),
        response_status: status === 'success' ? 200 : 500,
        status: status,
        error_message: errorMessage
    };

    try {
        await pool.query(
            `INSERT INTO audit_logs
            (action, ip_address, user_agent, endpoint, data_subject, user_id, user_role,
             request_data, response_status, status, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                logEntry.action,
                logEntry.ip_address,
                logEntry.user_agent,
                logEntry.endpoint,
                logEntry.data_subject,
                logEntry.user_id,
                logEntry.user_role,
                logEntry.request_data,
                logEntry.response_status,
                logEntry.status,
                logEntry.error_message
            ]
        );
    } catch (err) {
        console.error('Erro ao salvar log de auditoria:', err);
    }
}

// ========================================
// 4. PSEUDONIMIZAÇÃO E CRIPTOGRAFIA
// ========================================

function pseudonimize(personalData) {
    // Gera hash irreversível para identificação
    const hash = crypto
        .createHash('sha256')
        .update(personalData + process.env.SALT_SECRET)
        .digest('hex');

    return hash.substring(0, 32); // ID pseudônimo de 32 caracteres
}

function encryptSensitiveData(data) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

function decryptSensitiveData(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}

// ========================================
// 5. MIDDLEWARE DE CONSENTIMENTO (LGPD Art. 7, 8)
// ========================================

async function checkConsent(req, res, next) {
    const consentToken = req.headers['x-consent-token'];

    if (!consentToken) {
        await logDataAccess(req, 'CONSENT_CHECK_FAILED', null, 'failed', 'Token não fornecido');
        return res.status(403).json({
            error: 'Consentimento necessário',
            message: 'É necessário consentimento explícito para processar dados de saúde'
        });
    }

    try {
        // Verificar validade do consentimento no banco
        const result = await pool.query(
            'SELECT * FROM consents WHERE consent_token = $1 AND status = $2',
            [consentToken, 'active']
        );

        if (result.rows.length === 0) {
            await logDataAccess(req, 'CONSENT_CHECK_FAILED', null, 'failed', 'Token inválido ou expirado');
            return res.status(403).json({
                error: 'Consentimento inválido ou expirado',
                message: 'Por favor, forneça seu consentimento novamente'
            });
        }

        // Verificar se consentimento expirou
        const consent = result.rows[0];
        if (consent.expires_at && new Date(consent.expires_at) < new Date()) {
            await pool.query(
                'UPDATE consents SET status = $1 WHERE consent_token = $2',
                ['expired', consentToken]
            );
            await logDataAccess(req, 'CONSENT_EXPIRED', consent.pseudo_id, 'failed', 'Consentimento expirado');
            return res.status(403).json({
                error: 'Consentimento expirado',
                message: 'Seu consentimento expirou. Por favor, forneça um novo consentimento.'
            });
        }

        req.consentData = consent;
        next();
    } catch (err) {
        console.error('Erro ao verificar consentimento:', err);
        await logDataAccess(req, 'CONSENT_CHECK_ERROR', null, 'failed', err.message);
        return res.status(500).json({
            error: 'Erro ao verificar consentimento',
            message: 'Ocorreu um erro ao processar sua solicitação'
        });
    }
}

// ========================================
// 6. ROTAS DA API
// ========================================

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected'
        });
    }
});

// Registrar consentimento (LGPD Art. 8)
app.post('/api/consent', [
    body('participantEmail').isEmail().normalizeEmail(),
    body('participantName').isString().isLength({ min: 3 }),
    body('participantAge').isInt({ min: 18, max: 120 }),
    body('participantGender').isString().notEmpty(),
    body('participantEducation').isString().notEmpty(),
    body('consentTypes').isArray().notEmpty(),
    body('consentText').isString().isLength({ min: 10 }),
    body('ipAddress').optional().isIP(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        await logDataAccess(req, 'CONSENT_VALIDATION_FAILED', null, 'failed', JSON.stringify(errors.array()));
        return res.status(400).json({ errors: errors.array() });
    }

    const { participantEmail, participantName, participantAge, participantGender, participantEducation, consentTypes, consentText, ipAddress } = req.body;

    try {
        // Gerar token de consentimento único
        const consentToken = crypto.randomBytes(32).toString('hex');
        const pseudoId = pseudonimize(participantEmail);
        const clientIp = ipAddress || req.ip;
        const userAgent = req.get('user-agent');

        // Calcular data de expiração (2 anos)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 2);

        // Criptografar dados demográficos (dados sensíveis)
        const demographicsData = {
            name: participantName,
            email: participantEmail,
            age: participantAge,
            gender: participantGender,
            education: participantEducation
        };
        const encryptedDemographics = encryptSensitiveData(demographicsData);

        // Salvar no banco de dados
        await pool.query(
            `INSERT INTO consents
            (consent_token, pseudo_id, consent_types, consent_text, ip_address, user_agent, expires_at,
             encrypted_demographics, demographics_iv, demographics_auth_tag)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                consentToken,
                pseudoId,
                JSON.stringify(consentTypes),
                consentText,
                clientIp,
                userAgent,
                expiresAt,
                encryptedDemographics.encrypted,
                encryptedDemographics.iv,
                encryptedDemographics.authTag
            ]
        );

        await logDataAccess(req, 'CONSENT_REGISTERED', pseudoId, 'success');

        res.json({
            success: true,
            consentToken,
            message: 'Consentimento registrado com sucesso',
            expiresAt: expiresAt.toISOString()
        });
    } catch (err) {
        console.error('Erro ao registrar consentimento:', err);
        await logDataAccess(req, 'CONSENT_REGISTRATION_ERROR', null, 'failed', err.message);
        res.status(500).json({
            error: 'Erro ao registrar consentimento',
            message: 'Ocorreu um erro ao processar sua solicitação'
        });
    }
});

// Coletar dados TMT-A
app.post('/api/tmt-data',
    checkConsent,
    [
        body('sessionId').isString(),
        body('testPhase').isIn(['practice', 'test']),
        body('data').isObject(),
        body('results').optional().isObject(),
        body('metadata').optional().isObject(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await logDataAccess(req, 'TMT_DATA_VALIDATION_FAILED', req.consentData.pseudo_id, 'failed', JSON.stringify(errors.array()));
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId, testPhase, data, results, metadata } = req.body;
        const { pseudo_id, consent_token } = req.consentData;

        try {
            // Criptografar dados sensíveis
            const encryptedData = encryptSensitiveData(data);

            // Extrair métricas agregadas (não sensíveis)
            const totalTime = results?.totalTime || null;
            const totalErrors = results?.totalErrors || null;
            const accuracy = results?.accuracy || null;
            const completedNumbers = results?.completed || null;

            // Salvar no banco
            const result = await pool.query(
                `INSERT INTO tmt_data
                (pseudo_id, session_id, test_phase, encrypted_data, encryption_iv, encryption_auth_tag,
                 total_time, total_errors, accuracy, completed_numbers, metadata, consent_token)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id`,
                [
                    pseudo_id,
                    sessionId,
                    testPhase,
                    encryptedData.encrypted,
                    encryptedData.iv,
                    encryptedData.authTag,
                    totalTime,
                    totalErrors,
                    accuracy,
                    completedNumbers,
                    JSON.stringify(metadata || {}),
                    consent_token
                ]
            );

            await logDataAccess(req, 'TMT_DATA_COLLECTED', pseudo_id, 'success');

            res.json({
                success: true,
                recordId: result.rows[0].id,
                message: 'Dados coletados e armazenados com segurança'
            });
        } catch (err) {
            console.error('Erro ao coletar dados:', err);
            await logDataAccess(req, 'TMT_DATA_COLLECTION_ERROR', pseudo_id, 'failed', err.message);
            res.status(500).json({
                error: 'Erro ao coletar dados',
                message: 'Ocorreu um erro ao processar sua solicitação'
            });
        }
    }
);

// Revogar consentimento (LGPD Art. 8, §5º e Art. 18)
app.delete('/api/consent/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Buscar consentimento
        const result = await pool.query(
            'SELECT * FROM consents WHERE consent_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            await logDataAccess(req, 'CONSENT_REVOCATION_FAILED', null, 'failed', 'Token não encontrado');
            return res.status(404).json({
                error: 'Consentimento não encontrado'
            });
        }

        const consent = result.rows[0];

        // Marcar como revogado
        await pool.query(
            'UPDATE consents SET status = $1, revoked_at = $2 WHERE consent_token = $3',
            ['revoked', new Date(), token]
        );

        // Marcar dados para exclusão
        await pool.query(
            'UPDATE tmt_data SET deleted_at = $1 WHERE consent_token = $2',
            [new Date(), token]
        );

        await logDataAccess(req, 'CONSENT_REVOKED', consent.pseudo_id, 'success');

        res.json({
            success: true,
            message: 'Consentimento revogado. Dados serão removidos conforme política de retenção.'
        });
    } catch (err) {
        console.error('Erro ao revogar consentimento:', err);
        await logDataAccess(req, 'CONSENT_REVOCATION_ERROR', null, 'failed', err.message);
        res.status(500).json({
            error: 'Erro ao revogar consentimento',
            message: 'Ocorreu um erro ao processar sua solicitação'
        });
    }
});

// Solicitar dados (LGPD Art. 18 - direito de acesso)
app.get('/api/my-data/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Buscar consentimento
        const consentResult = await pool.query(
            'SELECT pseudo_id FROM consents WHERE consent_token = $1',
            [token]
        );

        if (consentResult.rows.length === 0) {
            await logDataAccess(req, 'DATA_ACCESS_FAILED', null, 'failed', 'Token não encontrado');
            return res.status(404).json({
                error: 'Consentimento não encontrado'
            });
        }

        const pseudoId = consentResult.rows[0].pseudo_id;

        // Buscar dados do titular
        const dataResult = await pool.query(
            `SELECT id, session_id, test_phase, encrypted_data, encryption_iv, encryption_auth_tag,
                    total_time, total_errors, accuracy, completed_numbers, collected_at
             FROM tmt_data
             WHERE pseudo_id = $1 AND deleted_at IS NULL
             ORDER BY collected_at DESC`,
            [pseudoId]
        );

        const records = dataResult.rows.map(record => ({
            recordId: record.id,
            sessionId: record.session_id,
            testPhase: record.test_phase,
            collectedAt: record.collected_at,
            summary: {
                totalTime: record.total_time,
                totalErrors: record.total_errors,
                accuracy: record.accuracy,
                completedNumbers: record.completed_numbers
            },
            data: decryptSensitiveData({
                encrypted: record.encrypted_data,
                iv: record.encryption_iv,
                authTag: record.encryption_auth_tag
            })
        }));

        await logDataAccess(req, 'DATA_ACCESS_REQUEST', pseudoId, 'success');

        res.json({
            success: true,
            records: records,
            totalRecords: records.length
        });
    } catch (err) {
        console.error('Erro ao acessar dados:', err);
        await logDataAccess(req, 'DATA_ACCESS_ERROR', null, 'failed', err.message);
        res.status(500).json({
            error: 'Erro ao acessar dados',
            message: 'Ocorreu um erro ao processar sua solicitação'
        });
    }
});

// Rota raiz - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// 7. TRATAMENTO DE ERROS
// ========================================

app.use((err, req, res, next) => {
    console.error('[ERROR]', err);

    // Não expor detalhes internos em produção
    const message = process.env.NODE_ENV === 'development'
        ? err.message
        : 'Ocorreu um erro ao processar sua solicitação';

    res.status(500).json({
        error: 'Erro interno do servidor',
        message: message
    });
});

// ========================================
// 8. INICIALIZAÇÃO
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔒 Servidor TMT-A LGPD rodando na porta ${PORT}`);
    console.log(`📋 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⚖️  Conformidade: LGPD + boas práticas internacionais`);
    console.log(`🗄️  Banco de dados: ${process.env.DB_NAME || 'tmt_data_db'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido, encerrando servidor...');
    pool.end(() => {
        console.log('Pool de conexões encerrado');
        process.exit(0);
    });
});

module.exports = app;
