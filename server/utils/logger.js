import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestContext } from '../middleware/requestContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists at boot
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Sensitive keys whose values must be masked in log metadata
const SENSITIVE_KEYS = new Set([
    'password', 'token', 'prompt', 'apikey', 'api_key', 'secret', 'jwt', 
    'authorization', 'accesstoken', 'access_token', 'session', 'message_content',
    'mentioned_ingredients', 'review_text', 'reviewtext', 'notes'
]);

/**
 * Recursively scans and masks sensitive keys/values in logs metadata
 */
function sanitize(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'object') {
        if (Array.isArray(val)) {
            return val.map(sanitize);
        }
        const cleaned = {};
        for (const [k, v] of Object.entries(val)) {
            const lowerK = k.toLowerCase();
            let isSensitive = false;
            for (const key of SENSITIVE_KEYS) {
                if (lowerK.includes(key)) {
                    isSensitive = true;
                    break;
                }
            }
            if (isSensitive) {
                cleaned[k] = '[MASKED]';
            } else {
                cleaned[k] = sanitize(v);
            }
        }
        return cleaned;
    }
    if (typeof val === 'string') {
        let cleanedStr = val;
        // Mask Bearer tokens
        cleanedStr = cleanedStr.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [MASKED]');
        // Mask query strings containing potential secrets
        cleanedStr = cleanedStr.replace(/(ai_key|api_key|secret|jwt|password|token)[^\s]*=\s*[a-zA-Z0-9_\-\.]+/gi, '$1=[MASKED]');
        return cleanedStr;
    }
    return val;
}

/**
 * Winston format that extracts request IDs from AsyncLocalStorage,
 * stamps the log entries, and recursively masks sensitive data.
 */
const customMaskingFormat = winston.format((info) => {
    const store = requestContext.getStore();
    info.requestId = store?.requestId || 'SYSTEM';

    // Mask sensitive details inside the primary log message string
    if (typeof info.message === 'string') {
        info.message = info.message.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [MASKED]');
        info.message = info.message.replace(/(ai_key|api_key|secret|jwt|password|token)[^\s]*=\s*[a-zA-Z0-9_\-\.]+/gi, '$1=[MASKED]');
    }

    // Recursively sanitize all metadata properties
    for (const [k, v] of Object.entries(info)) {
        if (k !== 'message' && k !== 'level' && k !== 'timestamp' && k !== 'requestId' && k !== 'context') {
            info[k] = sanitize(v);
        }
    }

    return info;
});

// Configure Winston instance
const winstonLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        customMaskingFormat(),
        winston.format.json()
    ),
    transports: [
        // Write all logs to logs/app.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'app.log') 
        }),
        // Write only error logs to logs/error.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        })
    ]
});

// Always write logs to Console in human-friendly readable format
winstonLogger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, requestId }) => {
            const ctxStr = context ? ` [${context}]` : '';
            const reqStr = requestId && requestId !== 'SYSTEM' ? ` [Req: ${requestId.substring(0, 8)}]` : '';
            return `${timestamp} ${level}:${reqStr}${ctxStr} ${message}`;
        })
    )
}));

/**
 * Standard gateway exporting the exact original interface of logger to prevent regressions.
 */
export const logger = {
    info(message, context = '', meta = {}) {
        winstonLogger.info(message, { context, ...meta });
    },

    warn(message, context = '', meta = {}) {
        winstonLogger.warn(message, { context, ...meta });
    },

    error(message, error = null, context = '', meta = {}) {
        const errorMeta = error ? { 
            error_message: error.message || String(error),
            error_stack: error.stack 
        } : {};
        winstonLogger.error(message, { context, ...errorMeta, ...meta });
    },

    externalFail(serviceName, url, error, context = '', meta = {}) {
        const errorMsg = error ? (error.message || String(error)) : 'Unknown Error';
        winstonLogger.error(`Communication with external service "${serviceName}" failed!`, {
            context,
            external_service: serviceName,
            url_target: url,
            error_message: errorMsg,
            ...meta
        });
    }
};
