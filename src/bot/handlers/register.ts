import type { ChatInputCommandInteraction, Role, GuildChannel } from 'discord.js';
const { EmbedBuilder, ChannelType } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

interface FactionData {
  id: string;
  name: string;
  prefix: string;
  timezone: string;
  discord_guild_id: string;
  admin_role_id: string;
  meeting_channel_id: string;
  radio_channel_id: string;
  voting_channel_id: string;
  fine_log_channel_id: string;
  created_at: string;
}

async function handleRegister(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Check if user has manage server permission
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({
        content: 'You need the "Manage Server" permission to register a faction.',
        ephemeral: true
      });
      return;
    }

    // Check if faction already exists
    const { data: existingFaction } = await supabase
      .from('factions')
      .select()
      .eq('discord_guild_id', interaction.guildId)
      .single();

    if (existingFaction) {
      await interaction.reply({
        content: 'This server already has a registered faction!',
        ephemeral: true
      });
      return;
    }

    // Get all required options
    const name = interaction.options.getString('name', true);
    const prefix = interaction.options.getString('prefix', true);
    const timezone = interaction.options.getString('timezone', true);
    const adminRole = interaction.options.getRole('admin_role', true) as Role;
    const meetingChannel = interaction.options.getChannel('meeting_channel', true) as GuildChannel;
    const radioChannel = interaction.options.getChannel('radio_channel', true) as GuildChannel;
    const votingChannel = interaction.options.getChannel('voting_channel', true) as GuildChannel;
    const fineLogChannel = interaction.options.getChannel('fine_log_channel', true) as GuildChannel;

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch (error) {
      logger.error('Timezone validation error:', error);
      await interaction.reply({
        content: `Invalid timezone "${timezone}". Please use a valid IANA timezone (e.g., "America/New_York").`,
        ephemeral: true
      });
      return;
    }

    // Validate channel types
    if (meetingChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Meeting channel must be a text channel.',
        ephemeral: true
      });
      return;
    }

    if (radioChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Radio channel must be a text channel.',
        ephemeral: true
      });
      return;
    }

    if (votingChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Voting channel must be a text channel.',
        ephemeral: true
      });
      return;
    }

    if (fineLogChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Fine log channel must be a text channel.',
        ephemeral: true
      });
      return;
    }

    // Create faction in database
    const { data: faction, error } = await supabase
      .from('factions')
      .insert({
        name,
        prefix,
        timezone,
        discord_guild_id: interaction.guildId,
        admin_role_id: adminRole.id,
        meeting_channel_id: meetingChannel.id,
        radio_channel_id: radioChannel.id,
        voting_channel_id: votingChannel.id,
        fine_log_channel_id: fineLogChannel.id
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating faction:', error);
      await interaction.reply({
        content: 'An error occurred while registering your faction. Please try again.',
        ephemeral: true
      });
      return;
    }

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Faction Registered Successfully')
      .addFields(
        { name: 'Name', value: faction.name, inline: true },
        { name: 'Prefix', value: faction.prefix, inline: true },
        { name: 'Timezone', value: faction.timezone, inline: true },
        { name: 'Admin Role', value: `<@&${faction.admin_role_id}>`, inline: true },
        { name: 'Meeting Channel', value: `<#${faction.meeting_channel_id}>`, inline: true },
        { name: 'Radio Channel', value: `<#${faction.radio_channel_id}>`, inline: true },
        { name: 'Voting Channel', value: `<#${faction.voting_channel_id}>`, inline: true },
        { name: 'Fine Log Channel', value: `<#${faction.fine_log_channel_id}>`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  } catch (error: unknown) {
    logger.error('Error in register command:', error);
    await interaction.reply({
      content: 'An unexpected error occurred. Please try again later.',
      ephemeral: true
    });
  }
}

module.exports = { handleRegister };