import { ChatInputCommandInteraction, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';



export async function handleRegister(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has manage server permission
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({
        content: 'You need the "Manage Server" permission to register a faction.',
        flags: 64
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
        flags: 64
      });
      return;
    }

    // Get all required options
    const name = interaction.options.getString('name', true);
    const prefix = interaction.options.getString('prefix', true);
    const timezone = interaction.options.getString('timezone', true);
    const adminRole = interaction.options.getRole('admin_role', true);
    const meetingChannel = interaction.options.getChannel('meeting_channel', true);
    const radioChannel = interaction.options.getChannel('radio_channel', true);
    const votingChannel = interaction.options.getChannel('voting_channel', true);
    const fineLogChannel = interaction.options.getChannel('fine_log_channel', true);

   // Validate timezone
try {
  // More reliable timezone validation
  new Intl.DateTimeFormat('en-US', { timeZone: timezone });
} catch (error) {
  logger.error('Timezone validation error:', error);
  await interaction.reply({
    content: `Invalid timezone "${timezone}". Please use a valid IANA timezone (e.g., "America/New_York").`,
    flags: 64
  });
  return;
}

    // Validate channels are text channels
    const channels = [meetingChannel, radioChannel, votingChannel, fineLogChannel];
    if (!channels.every(channel => channel.type === ChannelType.GuildText)) {
      await interaction.reply({
        content: 'All channels must be text channels.',
        flags: 64
      });
      return;
    }

    // Create faction
    const { data: faction, error: factionError } = await supabase
      .from('factions')
      .insert({
        name,
        discord_guild_id: interaction.guildId,
        prefix,
        timezone,
        admin_role_id: adminRole.id,
        meeting_channel_id: meetingChannel.id,
        radio_channel_id: radioChannel.id,
        voting_channel_id: votingChannel.id,
        fine_log_channel_id: fineLogChannel.id,
        appearance: {
          color: '#0099ff'
        }
      })
      .select()
      .single();

    if (factionError) {
      logger.error('Error creating faction:', factionError);
      throw factionError;
    }

    // Add creator as faction leader
    await supabase
      .from('faction_members')
      .insert({
        faction_id: faction.id,
        discord_user_id: interaction.user.id,
        role: 'LEADER'
      });

    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Faction Setup Complete!')
      .setDescription(`Welcome to ${name}! Your faction has been successfully registered.`)
      .addFields(
        {
          name: '📋 Faction Details',
          value: [
            `**Name:** ${name}`,
            `**Prefix:** ${prefix}`,
            `**Timezone:** ${timezone}`,
            `**Admin Role:** ${adminRole.name}`,
            '',
            '**Channels:**',
            `📅 Meetings: ${meetingChannel}`,
            `📻 Radio: ${radioChannel}`,
            `📊 Voting: ${votingChannel}`,
            `💰 Fines: ${fineLogChannel}`
          ].join('\n')
        },
        {
          name: '👥 Roles',
          value: [
            '**Leader:** Can manage all faction settings and members',
            '**Officers:** Can manage meetings, fines, and announcements',
            '**Members:** Can participate in meetings, votes, and use radio'
          ].join('\n')
        },
        {
          name: '🚀 Next Steps',
          value: [
            '1. Use `/config admin` to set up additional admin roles',
            '2. Invite your members to join the faction',
            '3. Schedule your first meeting with `/meeting schedule`',
            '4. Use `/help` to explore all available commands'
          ].join('\n')
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Type /help for a list of all commands' });

    // Send welcome message to all configured channels
    const setupMessages = [
      {
        channel: meetingChannel as TextChannel,
        message: '📅 This channel will be used for meeting announcements and coordination.'
      },
      {
        channel: radioChannel as TextChannel,
        message: '📻 This channel will be used for radio communications and announcements.'
      },
      {
        channel: votingChannel as TextChannel,
        message: '📊 This channel will be used for polls and voting.'
      },
      {
        channel: fineLogChannel as TextChannel,
        message: '💰 This channel will be used for fine notifications and tracking.'
      }
    ];

    for (const { channel, message } of setupMessages) {
      try {
        if (channel.isTextBased()) {
          await channel.send({
            content: `${message}\n\nChannel setup complete! ✅`,
            embeds: [
              new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Channel Configuration: ${channel.name}`)
                .setDescription(message)
                .setTimestamp()
            ]
          });
        }
      } catch (error) {
        logger.error(`Error sending setup message to channel ${channel.name}:`, error);
      }
    }

    // Reply to the interaction
    await interaction.reply({
      embeds: [welcomeEmbed],
      ephemeral: false
    });

    logger.info(`Faction "${name}" registered in guild ${interaction.guildId}`);
  } catch (error) {
    logger.error('Error in register command:', error);
    await interaction.reply({
      content: 'There was an error while registering your faction. Please try again later.',
      flags: 64
    });
  }
}