import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if the bot is alive'),

  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Start the faction setup process')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The name of your faction')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option
        .setName('prefix')
        .setDescription('Command prefix for your faction (e.g., !, $, ?)')
        .setRequired(true)
        .setMaxLength(3)
    )
    .addStringOption(option =>
      option
        .setName('timezone')
        .setDescription('Your faction\'s timezone (e.g., America/New_York)')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('admin_role')
        .setDescription('The admin role for your faction')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('meeting_channel')
        .setDescription('Channel for meeting announcements')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('radio_channel')
        .setDescription('Channel for radio communications')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('voting_channel')
        .setDescription('Channel for polls and voting')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('fine_log_channel')
        .setDescription('Channel for fine notifications')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Manage your faction profile')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your faction profile')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit your profile')
        .addStringOption(option =>
          option
            .setName('phone')
            .setDescription('Your phone number')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('twitter')
            .setDescription('Your Twitter handle')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('fine')
    .setDescription('Manage fines')
    .addSubcommand(subcommand =>
      subcommand
        .setName('issue')
        .setDescription('Issue a fine to a member')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to fine')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('amount')
            .setDescription('Fine amount')
            .setMinValue(1)
            .setMaxValue(1000000)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for the fine')
            .setRequired(true)
            .setMaxLength(1000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View fine history')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a fine')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Fine ID')
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName('meeting')
    .setDescription('Manage meetings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('schedule')
        .setDescription('Schedule a meeting')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Meeting title')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Meeting time (e.g., "2025-04-01 15:00")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Meeting description')
            .setMaxLength(2000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('emergency')
        .setDescription('Call an emergency meeting')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for emergency meeting')
            .setRequired(true)
            .setMaxLength(2000)
        )
    ),

  new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Manage radio settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set radio frequency')
        .addStringOption(option =>
          option
            .setName('frequency')
            .setDescription('Radio frequency (e.g., "123.45")')
            .setRequired(true)
            .setMinLength(6)
            .setMaxLength(6)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('announce')
        .setDescription('Make a radio announcement')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Announcement message')
            .setRequired(true)
            .setMaxLength(2000)
        )
    ),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Poll question')
        .setRequired(true)
        .setMaxLength(200)
    )
    .addStringOption(option =>
      option
        .setName('options')
        .setDescription('Poll options (comma-separated)')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addNumberOption(option =>
      option
        .setName('duration')
        .setDescription('Poll duration in minutes')
        .setMinValue(1)
        .setMaxValue(10080)
    ),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure faction settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('prefix')
        .setDescription('Set custom prefix')
        .addStringOption(option =>
          option
            .setName('prefix')
            .setDescription('New prefix')
            .setRequired(true)
            .setMaxLength(10)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('admin')
        .setDescription('Set admin role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Admin role')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('timezone')
        .setDescription('Set timezone')
        .addStringOption(option =>
          option
            .setName('timezone')
            .setDescription('Timezone (e.g., "America/New_York")')
            .setRequired(true)
        )
    )
].map(command => command.toJSON());