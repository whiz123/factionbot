import type { ChatInputCommandInteraction } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

interface CommandCategory {
  name: string;
  description: string;
}

type CommandCategories = Record<string, CommandCategory[]>;

const commands: CommandCategories = {
  basic: [
    { name: 'help', description: 'Show available commands' },
    { name: 'ping', description: 'Check if the bot is alive' },
    { name: 'register', description: 'Register your faction (Server Owner only)' }
  ],
  profile: [
    { name: 'profile view', description: 'View your faction profile' },
    { name: 'profile edit', description: 'Update your contact information' }
  ],
  management: [
    { name: 'fine issue', description: 'Issue a fine to a member' },
    { name: 'fine history', description: 'View fine history' },
    { name: 'fine remove', description: 'Remove a fine' }
  ],
  meetings: [
    { name: 'meeting schedule', description: 'Schedule a new meeting' },
    { name: 'meeting emergency', description: 'Call an emergency meeting' }
  ],
  radio: [
    { name: 'radio set', description: 'Set radio frequency' },
    { name: 'radio announce', description: 'Make a radio announcement' }
  ],
  voting: [
    { name: 'poll', description: 'Create a poll with multiple options' }
  ],
  config: [
    { name: 'config prefix', description: 'Set custom prefix' },
    { name: 'config admin', description: 'Set admin roles' },
    { name: 'config timezone', description: 'Set timezone' }
  ]
};

interface FactionMember {
  role: string;
}

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Get faction info to customize help based on user's role
    const { data: faction } = await supabase
      .from('factions')
      .select()
      .eq('discord_guild_id', interaction.guildId)
      .single();

    // Get member info if faction exists
    let member: FactionMember | null = null;
    if (faction) {
      const { data } = await supabase
        .from('faction_members')
        .select()
        .eq('faction_id', faction.id)
        .eq('discord_user_id', interaction.user.id)
        .single();
      member = data;
    }

    const isLeaderOrOfficer = member && ['LEADER', 'OFFICER'].includes(member.role);
    const isMember = !!member;

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📚 FiveM Factions - Help')
      .setDescription('Here are all available commands:')
      .addFields(
        {
          name: '🔰 Basic Commands',
          value: commands.basic
            .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
            .join('\n')
        }
      );

    if (!faction) {
      embed.setFooter({
        text: '⚠️ This server has no registered faction. Use /register to get started!'
      });
    } else {
      // Add member commands
      embed.addFields({
        name: '👤 Profile Commands',
        value: commands.profile
          .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
          .join('\n')
      });

      if (isLeaderOrOfficer) {
        embed.addFields(
          {
            name: '💰 Fine Management',
            value: commands.management
              .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
              .join('\n')
          },
          {
            name: '📅 Meeting Management',
            value: commands.meetings
              .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
              .join('\n')
          },
          {
            name: '📻 Radio System',
            value: commands.radio
              .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
              .join('\n')
          },
          {
            name: '⚙️ Configuration',
            value: commands.config
              .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
              .join('\n')
          }
        );
      }

      if (isMember) {
        embed.addFields({
          name: '📊 Voting System',
          value: commands.voting
            .map(cmd => `\`/${cmd.name}\` - ${cmd.description}`)
            .join('\n')
        });
      }

      // Add command usage examples
      embed.addFields({
        name: '📝 Examples',
        value: [
          '• `/meeting schedule title:"Weekly Meeting" time:"2025-04-01 15:00" description:"Regular update meeting"`',
          '• `/poll question:"Next event?" options:"Beach Day, Movie Night, Game Tournament" duration:120`',
          '• `/fine issue user:@member amount:50 reason:"Late to meeting"`'
        ].join('\n')
      });

      // Add faction-specific footer
      embed.setFooter({
        text: `Faction: ${faction.name} | Prefix: ${faction.prefix || '!'} | Your Role: ${member?.role || 'None'}`
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error: unknown) {
    logger.error('Error in help command:', error);
    await interaction.reply({
      content: 'There was an error while showing help information. Please try again later.',
      ephemeral: true
    });
  }
}

module.exports = { handleHelp };