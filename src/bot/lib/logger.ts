import winston from 'winston';
import { join } from 'path';
import { mkdir } from 'fs/promises';

// Ensure logs directory exists
async function ensureLogsDir() {
  try {
    await mkdir('logs', { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating logs directory:', error);
    }
  }
}

// Create logger after ensuring directory exists
await ensureLogsDir();

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.simple(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} ${level}: ${message}\n${stack}`;
    }
    return `${timestamp} ${level}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'discord-bot' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: join('logs', 'combined.log') }),
    new winston.transports.File({ filename: join('logs', 'error.log') }) as winston.transports.FileTransportInstance // ✅ Fix
  ]
});

export default logger;
