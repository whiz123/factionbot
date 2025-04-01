import type { ChatInputCommandInteraction, Message } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');
const { parseISO, addMinutes } = require('date-fns');
const { getTimezoneOffset } = require('date-fns-tz');

interface FactionMember {
  id: string;
  faction_id: string;
  discord_user_id: string;
  role: string;
}

interface Faction {
  id: string;
  name: string;
  timezone: string;
  meeting_channel_id?: string;
}

interface Meeting {
  id: string;
  faction_id: string;
  title: string;
  description?: string;
  scheduled_time: string;
  created_by_user_id: string;
  message_id?: string;
  channel_id?: string;
}

interface MeetingAttendance {
  id: string;
  meeting_id: string;
  member_id: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
}

type ValidRole = 'LEADER' | 'OFFICER';

async function handleMeeting(interaction: ChatInputCommandInteraction): Promise<void> {
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
        content: 'Only leaders and officers can manage meetings.',
        ephemeral: true
      });
      return;
    }

    switch (subcommand) {
      case 'schedule': {
        const title = interaction.options.getString('title', true);
        const timeStr = interaction.options.getString('time', true);
        const description = interaction.options.getString('description');

        let scheduledTime: Date;
        try {
          const parsedTime = parseISO(timeStr);
          const offset = getTimezoneOffset(faction.timezone);
          scheduledTime = addMinutes(parsedTime, -offset);
        } catch (error) {
          await interaction.reply({
            content: 'Invalid time format. Please use ISO 8601 format (YYYY-MM-DDTHH:mm:ss).',
            ephemeral: true
          });
          return;
        }

        // Validate meeting channel
        if (!faction.meeting_channel_id) {
          await interaction.reply({
            content: 'No meeting channel configured. Use `/config channels` to set one up.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📅 ' + title)
          .setDescription(description || 'No description provided.')
          .addFields(
            { name: 'Time', value: `<t:${Math.floor(scheduledTime.getTime() / 1000)}:F>`, inline: true },
            { name: 'Scheduled by', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setFooter({ text: 'Meeting ID will be provided after confirmation' })
          .setTimestamp();

        // Create meeting in database
        const { data: meeting, error } = await supabase
          .from('meetings')
          .insert({
            faction_id: faction.id,
            title,
            description,
            scheduled_time: scheduledTime.toISOString(),
            created_by_user_id: interaction.user.id
          })
          .select()
          .single();

        if (error) {
          logger.error('Error creating meeting:', error);
          await interaction.reply({
            content: 'An error occurred while scheduling the meeting.',
            ephemeral: true
          });
          return;
        }

        // Send meeting announcement
        const channel = await interaction.guild?.channels.fetch(faction.meeting_channel_id);
        if (!channel?.isTextBased()) {
          await interaction.reply({
            content: 'Could not find meeting channel or it is not a text channel.',
            ephemeral: true
          });
          return;
        }

        const message = await channel.send({
          content: '@everyone New meeting scheduled!',
          embeds: [embed.setFooter({ text: `Meeting ID: ${meeting.id}` })]
        }) as Message;

        // Update meeting with message info
        await supabase
          .from('meetings')
          .update({
            message_id: message.id,
            channel_id: channel.id
          })
          .eq('id', meeting.id);

        await interaction.reply({
          content: `Meeting scheduled! View it in <#${channel.id}>`,
          ephemeral: true
        });
        break;
      }

      case 'cancel': {
        const meetingId = interaction.options.getString('meeting_id', true);

        const { data: meeting, error: fetchError } = await supabase
          .from('meetings')
          .select()
          .eq('id', meetingId)
          .eq('faction_id', faction.id)
          .single();

        if (fetchError || !meeting) {
          await interaction.reply({
            content: 'Meeting not found or you do not have permission to cancel it.',
            ephemeral: true
          });
          return;
        }

        // Delete meeting and attendance records
        const { error: deleteError } = await supabase
          .from('meetings')
          .delete()
          .eq('id', meetingId);

        if (deleteError) {
          logger.error('Error canceling meeting:', deleteError);
          await interaction.reply({
            content: 'An error occurred while canceling the meeting.',
            ephemeral: true
          });
          return;
        }

        // Try to delete or update the announcement message
        if (meeting.channel_id && meeting.message_id) {
          try {
            const channel = await interaction.guild?.channels.fetch(meeting.channel_id);
            if (channel?.isTextBased()) {
              const message = await channel.messages.fetch(meeting.message_id);
              if (message) {
                const canceledEmbed = new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('❌ CANCELED: ' + meeting.title)
                  .setDescription(meeting.description || 'No description provided.')
                  .addFields(
                    { name: 'Was scheduled for', value: `<t:${Math.floor(new Date(meeting.scheduled_time).getTime() / 1000)}:F>`, inline: true },
                    { name: 'Canceled by', value: `<@${interaction.user.id}>`, inline: true }
                  )
                  .setTimestamp();

                await message.edit({
                  content: '~~@everyone New meeting scheduled!~~ **CANCELED**',
                  embeds: [canceledEmbed]
                });
              }
            }
          } catch (error) {
            logger.error('Error updating canceled meeting message:', error);
          }
        }

        await interaction.reply({
          content: 'Meeting has been canceled.',
          ephemeral: true
        });
        break;
      }

      case 'attendance': {
        const meetingId = interaction.options.getString('meeting_id', true);
        const userId = interaction.options.getUser('user', true);
        const status = interaction.options.getString('status', true) as MeetingAttendance['status'];

        // Get target member
        const { data: targetMember } = await supabase
          .from('faction_members')
          .select()
          .eq('faction_id', faction.id)
          .eq('discord_user_id', userId.id)
          .single();

        if (!targetMember) {
          await interaction.reply({
            content: 'The specified user is not a member of this faction.',
            ephemeral: true
          });
          return;
        }

        // Update or create attendance record
        const { error } = await supabase
          .from('meeting_attendance')
          .upsert({
            meeting_id: meetingId,
            member_id: targetMember.id,
            status
          });

        if (error) {
          logger.error('Error updating attendance:', error);
          await interaction.reply({
            content: 'An error occurred while updating attendance.',
            ephemeral: true
          });
          return;
        }

        const statusEmoji = {
          PRESENT: '✅',
          LATE: '⚠️',
          ABSENT: '❌'
        };

        await interaction.reply({
          content: `${statusEmoji[status]} Updated attendance for <@${userId.id}> to ${status}`,
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
    logger.error('Error in meeting command:', error);
    await interaction.reply({
      content: 'An error occurred while processing the meeting command.',
      ephemeral: true
    });
  }
}

module.exports = { handleMeeting };