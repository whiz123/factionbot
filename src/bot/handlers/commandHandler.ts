import type { ChatInputCommandInteraction } from 'discord.js';
const { handleHelp } = require('./help');
const { handleRegister } = require('./register');
const { handleProfile } = require('./profile');
const { handleFine } = require('./fine');
const { handleMeeting } = require('./meeting');
const { handleRadio } = require('./radio');
const { handlePoll } = require('./poll');
const { handleConfig } = require('./config');
const logger = require('../lib/logger');

async function handleCommands(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName } = interaction;

    switch (commandName) {
      case 'ping':
        await interaction.reply({
          content: `🏓 Pong! Latency: ${interaction.client.ws.ping}ms`,
          ephemeral: true
        });
        break;

      case 'help':
        await handleHelp(interaction);
        break;

      case 'register':
        await handleRegister(interaction);
        break;

      case 'profile':
        await handleProfile(interaction);
        break;

      case 'fine':
        await handleFine(interaction);
        break;

      case 'meeting':
        await handleMeeting(interaction);
        break;

      case 'radio':
        await handleRadio(interaction);
        break;

      case 'poll':
        await handlePoll(interaction);
        break;

      case 'config':
        await handleConfig(interaction);
        break;

      default:
        await interaction.reply({
          content: 'Unknown command.',
          ephemeral: true
        });
    }
  } catch (error: unknown) {
    logger.error('Error handling command:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while processing your command.',
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while processing your command.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Error sending error response:', replyError);
    }
  }
}

module.exports = { handleCommands };