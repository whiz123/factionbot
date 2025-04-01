import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

export async function handleProfile(interaction: ChatInputCommandInteraction) {
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
          .eq('issued_to_user_id', interaction.user.id)
          .eq('faction_id', faction.id);

        const { data: meetingAttendance } = await supabase
          .from('meeting_attendance')
          .select('status')
          .eq('discord_user_id', interaction.user.id)
          .in('status', ['ATTENDING', 'DECLINED', 'MAYBE']);

        const attendanceStats = meetingAttendance?.reduce((acc: Record<string, number>, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {});

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('👤 Member Profile')
          .addFields(
            { 
              name: '📋 Basic Information',
              value: [
                `**Role:** ${member.role}`,
                `**Joined:** <t:${Math.floor(new Date(member.joined_at).getTime() / 1000)}:R>`,
                `**Phone:** ${member.phone || 'Not set'}`,
                `**Twitter:** ${member.twitter || 'Not set'}`
              ].join('\n')
            },
            {
              name: '📊 Statistics',
              value: [
                `**Fines Received:** ${fineCount || 0}`,
                `**Meetings Attended:** ${attendanceStats?.ATTENDING || 0}`,
                `**Meetings Declined:** ${attendanceStats?.DECLINED || 0}`,
                `**Maybe Responses:** ${attendanceStats?.MAYBE || 0}`
              ].join('\n')
            }
          )
          .setTimestamp();

        if (member.profile_photo_url) {
          embed.setThumbnail(member.profile_photo_url);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'edit': {
        const phone = interaction.options.getString('phone');
        const twitter = interaction.options.getString('twitter');

        // Validate phone format if provided
        if (phone && !/^\+?[\d\s-()]{10,}$/.test(phone)) {
          await interaction.reply({
            content: 'Invalid phone number format.',
            ephemeral: true
          });
          return;
        }

        // Validate Twitter handle if provided
        if (twitter && !/^@?[a-zA-Z0-9_]{1,15}$/.test(twitter)) {
          await interaction.reply({
            content: 'Invalid Twitter handle format.',
            ephemeral: true
          });
          return;
        }

        const updates: Record<string, string> = {};
        if (phone) updates.phone = phone;
        if (twitter) updates.twitter = twitter.startsWith('@') ? twitter : `@${twitter}`;

        const { error } = await supabase
          .from('faction_members')
          .update(updates)
          .eq('id', member.id);

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Profile Updated')
          .setDescription('Your profile has been updated successfully.')
          .addFields(
            { 
              name: 'Updated Information',
              value: [
                phone ? `**Phone:** ${phone}` : null,
                twitter ? `**Twitter:** ${updates.twitter}` : null
              ].filter(Boolean).join('\n') || 'No changes made'
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      default:
        await interaction.reply({
          content: 'Invalid subcommand',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error in profile command:', error);
    await interaction.reply({
      content: 'There was an error while managing your profile. Please try again later.',
      ephemeral: true
    });
  }
}