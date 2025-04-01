import type { ChatInputCommandInteraction } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

interface FactionMember {
  id: string;
  faction_id: string;
  discord_user_id: string;
  role: string;
  joined_at: string;
  contact_info?: {
    discord?: string;
    email?: string;
    phone?: string;
  };
}

interface Faction {
  id: string;
  name: string;
  prefix: string;
  timezone: string;
}

interface MeetingAttendance {
  status: string;
}

async function handleProfile(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Get member info
    const { data: member } = await supabase
      .from('faction_members')
      .select()
      .eq('faction_id', faction.id)
      .eq('discord_user_id', interaction.user.id)
      .single();

    if (!member) {
      await interaction.reply({
        content: 'You are not a member of this faction.',
        ephemeral: true
      });
      return;
    }

    switch (subcommand) {
      case 'view': {
        // Get member statistics
        const { count: fineCount } = await supabase
          .from('fines')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', interaction.user.id)
          .eq('faction_id', faction.id);

        const { data: meetingAttendance } = await supabase
          .from('meeting_attendance')
          .select('status')
          .eq('member_id', member.id);

        const attendanceStats = meetingAttendance?.reduce((acc: Record<string, number>, curr: MeetingAttendance) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {}) || {};

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`${faction.name} Member Profile`)
          .setDescription(`Profile for <@${interaction.user.id}>`)
          .addFields(
            { name: 'Role', value: member.role, inline: true },
            { name: 'Member Since', value: `<t:${Math.floor(new Date(member.joined_at).getTime() / 1000)}:R>`, inline: true },
            { name: 'Fines', value: `${fineCount || 0} received`, inline: true },
            {
              name: 'Meeting Attendance',
              value: [
                `✅ Present: ${attendanceStats.PRESENT || 0}`,
                `⚠️ Late: ${attendanceStats.LATE || 0}`,
                `❌ Absent: ${attendanceStats.ABSENT || 0}`
              ].join('\n'),
              inline: true
            }
          );

        if (member.contact_info) {
          const contactFields = [];
          if (member.contact_info.discord) contactFields.push(`Discord: ${member.contact_info.discord}`);
          if (member.contact_info.email) contactFields.push(`Email: ${member.contact_info.email}`);
          if (member.contact_info.phone) contactFields.push(`Phone: ${member.contact_info.phone}`);

          if (contactFields.length > 0) {
            embed.addFields({
              name: 'Contact Information',
              value: contactFields.join('\n'),
              inline: false
            });
          }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'edit': {
        const discord = interaction.options.getString('discord');
        const email = interaction.options.getString('email');
        const phone = interaction.options.getString('phone');

        const { error } = await supabase
          .from('faction_members')
          .update({
            contact_info: {
              discord: discord || member.contact_info?.discord,
              email: email || member.contact_info?.email,
              phone: phone || member.contact_info?.phone
            }
          })
          .eq('id', member.id);

        if (error) {
          logger.error('Error updating profile:', error);
          await interaction.reply({
            content: 'An error occurred while updating your profile.',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: 'Your profile has been updated successfully.',
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
    logger.error('Error in profile command:', error);
    await interaction.reply({
      content: 'An error occurred while processing your command.',
      ephemeral: true
    });
  }
}

module.exports = { handleProfile };