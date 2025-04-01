import type { ChatInputCommandInteraction } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

interface FactionMember {
  id: string;
  faction_id: string;
  discord_user_id: string;
  role: string;
}

interface Faction {
  id: string;
  name: string;
  prefix: string;
  timezone: string;
  meeting_channel_id?: string;
  voting_channel_id?: string;
  announcement_channel_id?: string;
}

type ValidRole = 'LEADER' | 'OFFICER';

async function handleConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    // Get faction info
    const { data: faction } = await supabase
      .from('factions')
      .select()
      .eq('discord_guild_id', interaction.guildId)
      .single();

    if (!faction) {
      await interaction.reply({
        content: 'This server does not have a registered faction. Use `/register` first.',
        ephemeral: true
      });
      return;
    }

    // Check if user has permission
    const { data: member } = await supabase
      .from('faction_members')
      .select()
      .eq('faction_id', faction.id)
      .eq('discord_user_id', interaction.user.id)
      .single();

    if (!member || !['LEADER', 'OFFICER'].includes(member.role as ValidRole)) {
      await interaction.reply({
        content: 'You do not have permission to modify faction settings.',
        ephemeral: true
      });
      return;
    }

    switch (subcommand) {
      case 'prefix': {
        const prefix = interaction.options.getString('prefix', true);
        
        if (prefix.length > 10) {
          await interaction.reply({
            content: 'Prefix must be 10 characters or less.',
            ephemeral: true
          });
          return;
        }

        const { error } = await supabase
          .from('factions')
          .update({ prefix })
          .eq('id', faction.id);

        if (error) {
          logger.error('Error updating faction prefix:', error);
          await interaction.reply({
            content: 'An error occurred while updating the prefix.',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: `Faction prefix updated to: ${prefix}`,
          ephemeral: true
        });
        break;
      }

      case 'timezone': {
        const timezone = interaction.options.getString('timezone', true);

        // Validate timezone
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch (error) {
          await interaction.reply({
            content: 'Invalid timezone. Please use a valid IANA timezone identifier (e.g., America/New_York).',
            ephemeral: true
          });
          return;
        }

        const { error } = await supabase
          .from('factions')
          .update({ timezone })
          .eq('id', faction.id);

        if (error) {
          logger.error('Error updating faction timezone:', error);
          await interaction.reply({
            content: 'An error occurred while updating the timezone.',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: `Faction timezone updated to: ${timezone}`,
          ephemeral: true
        });
        break;
      }

      case 'channels': {
        const meetingChannel = interaction.options.getChannel('meeting');
        const votingChannel = interaction.options.getChannel('voting');
        const announcementChannel = interaction.options.getChannel('announcements');

        const updates: Partial<Faction> = {};
        if (meetingChannel) updates.meeting_channel_id = meetingChannel.id;
        if (votingChannel) updates.voting_channel_id = votingChannel.id;
        if (announcementChannel) updates.announcement_channel_id = announcementChannel.id;

        const { error } = await supabase
          .from('factions')
          .update(updates)
          .eq('id', faction.id);

        if (error) {
          logger.error('Error updating faction channels:', error);
          await interaction.reply({
            content: 'An error occurred while updating the channels.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Channel Configuration Updated')
          .setDescription('The following channels have been updated:')
          .addFields(
            meetingChannel ? { name: 'Meeting Channel', value: `<#${meetingChannel.id}>`, inline: true } : null,
            votingChannel ? { name: 'Voting Channel', value: `<#${votingChannel.id}>`, inline: true } : null,
            announcementChannel ? { name: 'Announcement Channel', value: `<#${announcementChannel.id}>`, inline: true } : null
          )
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        break;
      }

      default:
        await interaction.reply({
          content: 'Unknown subcommand.',
          ephemeral: true
        });
    }
  } catch (error: unknown) {
    logger.error('Error in config command:', error);
    await interaction.reply({
      content: 'An error occurred while updating the configuration.',
      ephemeral: true
    });
  }
}

module.exports = { handleConfig };