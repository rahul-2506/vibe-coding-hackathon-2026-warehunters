const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

export const logger = {
    info(message, context = '') {
        const ctxStr = context ? ` [${context}]` : '';
        console.log(`${COLORS.blue}[INFO]${ctxStr} ${message}${COLORS.reset}`);
    },

    warn(message, context = '') {
        const ctxStr = context ? ` [${context}]` : '';
        console.warn(`${COLORS.yellow}[WARN]${ctxStr} ${message}${COLORS.reset}`);
    },

    error(message, error = null, context = '') {
        const ctxStr = context ? ` [${context}]` : '';
        const errMsg = error ? `: ${error.message || error}` : '';
        const errStack = error && error.stack ? `\nStack: ${error.stack}` : '';
        console.error(`${COLORS.red}[ERROR]${ctxStr} ${message}${errMsg}${errStack}${COLORS.reset}`);
    },

    externalFail(serviceName, url, error, context = '') {
        const ctxStr = context ? ` [${context}]` : '';
        console.error(
            `${COLORS.magenta}[API_FAIL]${ctxStr} Communication with external service "${serviceName}" failed!\n` +
            `URL Target: ${url}\n` +
            `Error Message: ${error.message || error}${COLORS.reset}`
        );
    }
};
