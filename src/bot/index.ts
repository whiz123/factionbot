import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { registerCommands } from './commands/register.js';
import { handleCommands } from './handlers/commandHandler.js';
import logger from './lib/logger.js';


// Load environment variables
config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Configure client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

// Event handlers
client.once(Events.ClientReady, async (c) => {
  logger.info(`Ready! Logged in as ${c.user.tag}`);
  
  // Register commands on startup
  try {
    const data = await registerCommands();
    logger.info(`Successfully registered ${Array.isArray(data) ? data.length : 0} commands`);
  } catch (error) {
    logger.error('Failed to register commands:', error);
    process.exit(1); // Exit if we can't register commands
  }
});

client.on(Events.InteractionCreate, handleCommands);

// Error handling
client.on(Events.Error, error => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch(error => {
  logger.error('Failed to login:', error);
  process.exit(1);
});