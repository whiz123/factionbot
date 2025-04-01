import type { Interaction } from 'discord.js';
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { config } = require('dotenv');
const { registerCommands } = require('./commands/register.js');
const { handleCommands } = require('./handlers/commandHandler.js');
const logger = require('./lib/logger.js');

// Load environment variables
config();

// Validate required environment variables
const token = process.env.DISCORD_TOKEN as string;
if (!token) {
  logger.error('Missing Discord token');
  process.exit(1);
}

const requiredEnvVars = ['CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Configure client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Event handlers
client.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

client.on('error', (error: Error) => {
  logger.error('Client error:', error);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommands(interaction);
  } catch (error: unknown) {
    logger.error('Error handling command:', error);
    await interaction.reply({ 
      content: 'An error occurred while processing your command.', 
      ephemeral: true 
    }).catch(() => {});
  }
});

// Error handling
process.on('unhandledRejection', (error: unknown) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

async function start(): Promise<void> {
  try {
    await registerCommands();
    await client.login(token);
  } catch (error: unknown) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();