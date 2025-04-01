import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

export async function handleFine(interaction: ChatInputCommandInteraction) {
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
        content: 'You do not have permission to manage fines.',
        ephemeral: true
      });
      return;
    }

    switch (subcommand) {
      case 'issue': {
        const user = interaction.options.getUser('user', true);
        const amount = interaction.options.getNumber('amount', true);
        const reason = interaction.options.getString('reason', true);

        // Validate amount
        if (amount <= 0 || amount > 1000000) {
          await interaction.reply({
            content: 'Fine amount must be between 1 and 1,000,000.',
            ephemeral: true
          });
          return;
        }

        // Check if target user is a member
        const { data: targetMember } = await supabase
          .from('faction_members')
          .select()
          .eq('faction_id', faction.id)
          .eq('discord_user_id', user.id)
          .single();

        if (!targetMember) {
          await interaction.reply({
            content: 'You can only fine members of your faction.',
            ephemeral: true
          });
          return;
        }

        // Prevent fining higher-ranked members
        if (
          (member.role === 'OFFICER' && ['LEADER', 'OFFICER'].includes(targetMember.role)) ||
          (member.role === 'LEADER' && targetMember.role === 'LEADER' && user.id !== interaction.user.id)
        ) {
          await interaction.reply({
            content: 'You cannot fine members of equal or higher rank.',
            ephemeral: true
          });
          return;
        }

        // Insert fine into database
        const { data: fine, error } = await supabase
          .from('fines')
          .insert({
            faction_id: faction.id,
            issued_to_user_id: user.id,
            issued_by_user_id: interaction.user.id,
            amount,
            reason,
          })
          .select()
          .single();

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('💰 Fine Issued')
          .addFields(
            { name: '👤 Member', value: user.tag, inline: true },
            { name: '💵 Amount', value: `$${amount.toLocaleString()}`, inline: true },
            { name: '📝 Reason', value: reason },
            { name: '👮 Issued By', value: interaction.user.tag, inline: true },
            { name: '🆔 Fine ID', value: fine.id, inline: true }
          )
          .setTimestamp();

        // Send to fine log channel if configured
        if (faction.fine_log_channel_id) {
          const channel = interaction.guild?.channels.cache.get(faction.fine_log_channel_id);
          if (channel?.isTextBased()) {
            await channel.send({ 
              content: `<@${user.id}>`,
              embeds: [embed] 
            });
          }
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'history': {
        // Get all fines for the faction with user details
        const { data: fines } = await supabase
          .from('fines')
          .select()
          .eq('faction_id', faction.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📜 Recent Fines')
          .setDescription(
            fines && fines.length > 0
              ? fines.map(fine => 
                  `**ID:** ${fine.id}\n` +
                  `**Member:** <@${fine.issued_to_user_id}>\n` +
                  `**Amount:** $${fine.amount.toLocaleString()}\n` +
                  `**Reason:** ${fine.reason}\n` +
                  `**Status:** ${fine.paid ? '✅ Paid' : '❌ Unpaid'}\n` +
                  `**Issued By:** <@${fine.issued_by_user_id}>\n` +
                  `**Date:** <t:${Math.floor(new Date(fine.created_at).getTime() / 1000)}:R>`
                ).join('\n\n---\n\n')
              : 'No fines found.'
          )
          .setFooter({ text: 'Only showing the 10 most recent fines' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'remove': {
        const fineId = interaction.options.getString('id', true);

        // Get fine details first
        const { data: fine } = await supabase
          .from('fines')
          .select()
          .eq('id', fineId)
          .eq('faction_id', faction.id)
          .single();

        if (!fine) {
          await interaction.reply({
            content: 'Fine not found or does not belong to this faction.',
            ephemeral: true
          });
          return;
        }

        // Only allow removing fines issued by self unless leader
        if (member.role !== 'LEADER' && fine.issued_by_user_id !== interaction.user.id) {
          await interaction.reply({
            content: 'You can only remove fines that you issued.',
            ephemeral: true
          });
          return;
        }

        const { error } = await supabase
          .from('fines')
          .delete()
          .eq('id', fineId)
          .eq('faction_id', faction.id);

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Fine Removed')
          .setDescription(`Fine ${fineId} has been removed.`)
          .addFields(
            { name: 'Removed By', value: interaction.user.tag },
            { name: 'Original Amount', value: `$${fine.amount.toLocaleString()}` },
            { name: 'Member', value: `<@${fine.issued_to_user_id}>` }
          )
          .setTimestamp();

        // Log to fine log channel if configured
        if (faction.fine_log_channel_id) {
          const channel = interaction.guild?.channels.cache.get(faction.fine_log_channel_id);
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [embed] });
          }
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({
          content: 'Invalid subcommand',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error in fine command:', error);
    await interaction.reply({
      content: 'There was an error while managing fines. Please try again later.',
      ephemeral: true
    });
  }
}