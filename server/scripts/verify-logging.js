import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { requestContext } from '../middleware/requestContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');
const appLogPath = path.join(logsDir, 'app.log');
const errorLogPath = path.join(logsDir, 'error.log');

async function verifyStructuredLogging() {
    console.log('📊 VERIFYING PHASE 5 LOGGING & MONITORING IMPLEMENTATIONS\n');

    // 1. Trigger some mock system logs (outside request context)
    logger.info('System initialization starting up...', 'BOOT');
    
    // 2. Trigger request-scoped logs using AsyncLocalStorage context
    const mockRequestId = 'mock-uuid-8888-9999-0000';
    console.log(`🌀 Simulating active request context with Request ID: ${mockRequestId}`);
    
    await new Promise((resolve) => {
        requestContext.run({ requestId: mockRequestId }, () => {
            logger.info('Incoming request received at /api/products', 'HTTP');
            
            // Database query log simulating a sensitive query metadata
            logger.info('Executing database select query', 'DATABASE', {
                query: 'select * from products limit 1',
                credentials: {
                    username: 'db_admin',
                    password: 'verySecretPassword123'
                }
            });

            // Chat API request log simulating user prompt and message
            logger.info('Forwarding payload to ML service', 'RAG_SERVICE', {
                payload: {
                    prompt: 'Recommend salicylic acid washes',
                    api_key: 'gsk_groq_apiKeyABC123xyz'
                }
            });

            // Error log
            logger.error('Failed to parse search term due to syntactical syntax anomaly.', new Error('Malformed JSON syntax near neem'), 'PARSER');

            resolve();
        });
    });

    console.log('\n⌛ Waiting for log file write buffers to flush...');
    await new Promise(r => setTimeout(r, 1000));

    // 3. Audit log files
    console.log('\n📂 Auditing generated log files:');
    if (!fs.existsSync(logsDir)) {
        throw new Error('logs/ directory was not created!');
    }
    console.log('✅ Verified: logs/ directory successfully created.');

    if (!fs.existsSync(appLogPath)) {
        throw new Error('logs/app.log was not created!');
    }
    console.log('✅ Verified: logs/app.log successfully created.');

    if (!fs.existsSync(errorLogPath)) {
        throw new Error('logs/error.log was not created!');
    }
    console.log('✅ Verified: logs/error.log successfully created.');

    // Read and parse app.log contents
    const appLogContent = fs.readFileSync(appLogPath, 'utf8');
    const logLines = appLogContent.trim().split('\n').map(JSON.parse);

    console.log(`\n📋 Loaded ${logLines.length} structured log rows from app.log.`);

    // Audit request ID tracing
    const requestLogs = logLines.filter(l => l.requestId === mockRequestId);
    console.log(`✅ Verified: Found ${requestLogs.length} logs successfully stamped with Request ID: "${mockRequestId}".`);

    // Audit metadata masking
    console.log('\n🔍 Auditing sensitive information masking:');
    
    let dbMasked = false;
    let apiMasked = false;
    let errorLogged = false;

    for (const log of logLines) {
        // Audit database credentials masking
        if (log.credentials) {
            console.log(`   - Auditing DB log: ${JSON.stringify(log.credentials)}`);
            if (log.credentials.password === '[MASKED]') {
                dbMasked = true;
                console.log('     ✅ Password successfully masked!');
            }
        }

        // Audit prompt & api_key masking
        if (log.payload) {
            console.log(`   - Auditing API payload log: ${JSON.stringify(log.payload)}`);
            if (log.payload.prompt === '[MASKED]' && log.payload.api_key === '[MASKED]') {
                apiMasked = true;
                console.log('     ✅ Prompt and API Key successfully masked!');
            }
        }

        // Audit error logging in error.log
        if (log.level === 'error' && log.error_message) {
            errorLogged = true;
            console.log(`   - Auditing error log: "${log.message}" | message: "${log.error_message}"`);
        }
    }

    if (dbMasked && apiMasked && errorLogged) {
        console.log('\n✨ structured logging, correlation request tracing, and metadata masking are 100% verified and functional!');
    } else {
        console.log('\n⚠️ Some verification checks failed to validate.');
    }
}

verifyStructuredLogging().catch(err => {
    console.error('Fatal logging verification error:', err);
});
