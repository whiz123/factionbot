import { Interaction } from 'discord.js';
import { handleHelp } from './help.js';
import { handleRegister } from './register.js';
import { handleProfile } from './profile.js';
import { handleFine } from './fine.js';
import { handleMeeting } from './meeting.js';
import { handleRadio } from './radio.js';
import { handlePoll } from './poll.js';
import { handleConfig } from './config.js';
import logger from '../lib/logger.js';

export async function handleCommands(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    const { commandName } = interaction;

    switch (commandName) {
      case 'ping':
        await interaction.reply({
          content: `🏓 Pong! Latency: ${interaction.client.ws.ping}ms`,
          flags: 64
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
          content: 'Unknown command. Use `/help` to see available commands.',
          flags: 64
        });
    }
  } catch (error) {
    logger.error('Error handling command:', error);
    
    try {
      const response = {
        content: 'An error occurred while processing your command. Please try again later.',
        flags: 64
      };

      if (interaction.deferred) {
        await interaction.editReply(response);
      } else if (interaction.replied) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    } catch (followUpError) {
      logger.error('Error sending error response:', followUpError);
    }
  }
}