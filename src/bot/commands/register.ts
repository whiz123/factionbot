import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './index.js';
import logger from '../lib/logger.js';

config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  logger.error('Missing required environment variables (DISCORD_TOKEN, CLIENT_ID)');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

export async function registerCommands() {
  try {
    logger.info('Started refreshing application (/) commands.');

    const data = await rest.put(
      Routes.applicationCommands(clientId!),
      { body: commands }
    );

    logger.info(`Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`);
    return data;
  } catch (error) {
    logger.error('Error registering commands:', error);
    throw error;
  }
}

// Only run if this file is being executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  registerCommands().catch((error) => {
    logger.error('Failed to register commands:', error);
    process.exit(1);
  });
}