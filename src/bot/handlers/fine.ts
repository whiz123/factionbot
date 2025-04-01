import type { ChatInputCommandInteraction, User } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');

interface FactionMember {
  role: string;
}

interface Fine {
  id: string;
  faction_id: string;
  user_id: string;
  issuer_id: string;
  amount: number;
  reason: string;
  created_at: string;
  paid: boolean;
}

interface Faction {
  id: string;
  fine_log_channel_id: string;
}

async function handleFine(interaction: ChatInputCommandInteraction): Promise<void> {
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

        // Create fine
        const { data: fine, error } = await supabase
          .from('fines')
          .insert({
            faction_id: faction.id,
            user_id: user.id,
            issuer_id: interaction.user.id,
            amount,
            reason,
            paid: false
          })
          .select()
          .single();

        if (error) {
          logger.error('Error creating fine:', error);
          await interaction.reply({
            content: 'An error occurred while issuing the fine.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('💰 Fine Issued')
          .addFields(
            { name: 'User', value: `<@${fine.user_id}>`, inline: true },
            { name: 'Amount', value: `$${fine.amount.toLocaleString()}`, inline: true },
            { name: 'Reason', value: fine.reason },
            { name: 'Issued By', value: `<@${fine.issuer_id}>`, inline: true },
            { name: 'Status', value: 'Unpaid', inline: true }
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
        const user = interaction.options.getUser('user');
        const { data: fines } = await supabase
          .from('fines')
          .select()
          .eq('faction_id', faction.id)
          .eq('user_id', user?.id || null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!fines?.length) {
          await interaction.reply({
            content: user ? `No fines found for ${user.tag}.` : 'No fines found.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('💰 Fine History')
          .setDescription(user ? `Showing fines for ${user.tag}` : 'Showing recent fines');

        for (const fine of fines) {
          embed.addFields({
            name: `Fine #${fine.id}`,
            value: [
              `**Amount:** $${fine.amount.toLocaleString()}`,
              `**Reason:** ${fine.reason}`,
              `**Status:** ${fine.paid ? '✅ Paid' : '❌ Unpaid'}`,
              `**Issued By:** <@${fine.issuer_id}>`,
              `**Date:** <t:${Math.floor(new Date(fine.created_at).getTime() / 1000)}:R>`
            ].join('\n')
          });
        }

        await interaction.reply({ embeds: [embed] });
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
        if (member.role !== 'LEADER' && fine.issuer_id !== interaction.user.id) {
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

        if (error) {
          logger.error('Error removing fine:', error);
          await interaction.reply({
            content: 'An error occurred while removing the fine.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Fine Removed')
          .setDescription(`Fine #${fineId} has been removed.`)
          .addFields(
            { name: 'Removed By', value: interaction.user.tag },
            { name: 'Original Amount', value: `$${fine.amount.toLocaleString()}` },
            { name: 'Member', value: `<@${fine.user_id}>` }
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
          content: 'Unknown subcommand.',
          ephemeral: true
        });
    }
  } catch (error: unknown) {
    logger.error('Error in fine command:', error);
    await interaction.reply({
      content: 'An error occurred while processing your command.',
      ephemeral: true
    });
  }
}

module.exports = { handleFine };