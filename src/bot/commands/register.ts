import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
const { REST, Routes } = require('discord.js');
const { config } = require('dotenv');
const { commands } = require('./index');
const logger = require('../lib/logger');

config();

const token = process.env.DISCORD_TOKEN as string;
const clientId = process.env.CLIENT_ID as string;

if (!token || !clientId) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

const rest = new REST().setToken(token);

interface CommandDefinition {
  name: string;
  description: string;
}

// Convert command definitions to Discord.js slash command format
const slashCommands: RESTPostAPIApplicationCommandsJSONBody[] = Object.values(commands)
  .flat()
  .map((cmd) => {
    const command = cmd as CommandDefinition;
    return {
      name: command.name.split(' ')[0],
      description: command.description,
      options: command.name.includes(' ') ? [{
        name: command.name.split(' ')[1],
        description: 'Subcommand',
        type: 1
      }] : []
    };
  });

async function registerCommands(): Promise<void> {
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: slashCommands }
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error: unknown) {
    logger.error('Error refreshing commands:', error);
    throw error;
  }
}

// Only run if this file is being executed directly
if (require.main === module) {
  registerCommands().catch((error) => {
    logger.error('Failed to register commands:', error);
    process.exit(1);
  });
}

module.exports = { registerCommands };