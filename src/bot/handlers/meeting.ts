import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';
import { parseISO } from 'date-fns';
import { getTimezoneOffset } from 'date-fns-tz';

export async function handleMeeting(interaction: ChatInputCommandInteraction) {
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

    if (!member || !['LEADER', 'OFFICER'].includes(member.role)) {
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
          scheduledTime = new Date(parsedTime.getTime() - offset);

          if (scheduledTime < new Date()) {
            await interaction.reply({
              content: 'Meeting time must be in the future.',
              ephemeral: true
            });
            return;
          }
        } catch (error) {
          await interaction.reply({
            content: 'Invalid time format. Please use format: "2025-04-01 15:00"',
            ephemeral: true
          });
          return;
        }

        // Create meeting in database
        const { data: meeting, error } = await supabase
          .from('meetings')
          .insert({
            faction_id: faction.id,
            title,
            description,
            scheduled_for: scheduledTime.toISOString(),
            created_by_user_id: interaction.user.id,
            notify_roles: faction.admin_role_id ? [faction.admin_role_id] : []
          })
          .select()
          .single();

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📅 Meeting Scheduled')
          .addFields(
            { name: '📝 Title', value: title },
            { 
              name: '🕒 Time', 
              value: `<t:${Math.floor(scheduledTime.getTime() / 1000)}:F>\n(<t:${Math.floor(scheduledTime.getTime() / 1000)}:R>)` 
            },
            { name: '📋 Description', value: description || 'No description provided' },
            { name: '👤 Organized by', value: interaction.user.tag }
          )
          .setFooter({ text: 'React with ✅ to attend, ❌ to decline, or ❓ if unsure' })
          .setTimestamp();

        const message = await interaction.reply({
          content: faction.admin_role_id ? `<@&${faction.admin_role_id}>` : undefined,
          embeds: [embed],
          fetchReply: true
        });

        // Add attendance reaction options
        await message.react('✅');
        await message.react('❌');
        await message.react('❓');

        // Set up collector for attendance
        const collector = message.createReactionCollector({ 
          time: scheduledTime.getTime() - Date.now() 
        });

        collector.on('collect', async (reaction, user) => {
          if (user.bot) return;

          const statusMap: { [key: string]: string } = {
            '✅': 'ATTENDING',
            '❌': 'DECLINED',
            '❓': 'MAYBE'
          };

          const status = statusMap[reaction.emoji.name!];
          if (!status) return;

          try {
            // Record attendance in database
            await supabase
              .from('meeting_attendance')
              .upsert({
                meeting_id: meeting.id,
                discord_user_id: user.id,
                status
              });
          } catch (error) {
            logger.error('Error recording meeting attendance:', error);
          }
        });

        // Schedule meeting notification
        const notificationTime = new Date(scheduledTime.getTime() - 15 * 60000); // 15 minutes before
        if (notificationTime > new Date() && faction.meeting_channel_id) {
          setTimeout(async () => {
            try {
              const channel = interaction.guild?.channels.cache.get(faction.meeting_channel_id!);
              if (channel?.isTextBased()) {
                const { data: attendees } = await supabase
                  .from('meeting_attendance')
                  .select('discord_user_id')
                  .eq('meeting_id', meeting.id)
                  .eq('status', 'ATTENDING');

                const reminderEmbed = new EmbedBuilder()
                  .setColor('#ffaa00')
                  .setTitle('⏰ Meeting Reminder')
                  .setDescription(`Meeting "${title}" starts in 15 minutes!`)
                  .addFields({
                    name: 'Confirmed Attendees',
                    value: attendees?.length 
                      ? attendees.map(a => `<@${a.discord_user_id}>`).join('\n')
                      : 'No confirmed attendees'
                  });

                await channel.send({
                  content: faction.admin_role_id ? `<@&${faction.admin_role_id}>` : undefined,
                  embeds: [reminderEmbed]
                });
              }
            } catch (error) {
              logger.error('Error sending meeting reminder:', error);
            }
          }, notificationTime.getTime() - Date.now());
        }
        break;
      }

      case 'emergency': {
        const reason = interaction.options.getString('reason', true);
        
        // Create emergency meeting
        const { data: meeting, error } = await supabase
          .from('meetings')
          .insert({
            faction_id: faction.id,
            title: '🚨 Emergency Meeting',
            description: reason,
            scheduled_for: new Date().toISOString(),
            created_by_user_id: interaction.user.id,
            is_emergency: true,
            notify_roles: faction.admin_role_id ? [faction.admin_role_id] : []
          })
          .select()
          .single();

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🚨 Emergency Meeting Called')
          .setDescription(reason)
          .addFields(
            { name: 'Called By', value: interaction.user.tag },
            { name: 'Status', value: '⚠️ Immediate attendance required' }
          )
          .setTimestamp();

        const mentions = ['@everyone'];
        if (faction.admin_role_id) {
          mentions.push(`<@&${faction.admin_role_id}>`);
        }

        await interaction.reply({
          content: mentions.join(' '),
          embeds: [embed]
        });

        // Send to meeting channel if configured
        if (faction.meeting_channel_id) {
          const channel = interaction.guild?.channels.cache.get(faction.meeting_channel_id);
          if (channel?.isTextBased()) {
            await channel.send({
              content: mentions.join(' '),
              embeds: [embed]
            });
          }
        }
        break;
      }

      default:
        await interaction.reply({
          content: 'Invalid subcommand',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error in meeting command:', error);
    await interaction.reply({
      content: 'There was an error while managing the meeting. Please try again later.',
      ephemeral: true
    });
  }
}