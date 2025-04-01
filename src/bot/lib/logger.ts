import type { Logger } from 'winston';
const winston = require('winston');
const { join } = require('path');
const { mkdir } = require('fs/promises');

const logDir = join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
mkdir(logDir, { recursive: true }).catch((error: Error) => console.error(error));

const logger: Logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: join(logDir, 'combined.log') })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
