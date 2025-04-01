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
  radio_frequency?: string;
  radio_updated_at?: string;
  radio_updated_by?: string;
}

type ValidRole = 'LEADER' | 'OFFICER';

async function handleRadio(interaction: ChatInputCommandInteraction): Promise<void> {
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

    if (!member) {
      await interaction.reply({
        content: 'You must be a faction member to use radio commands.',
        ephemeral: true
      });
      return;
    }

    switch (subcommand) {
      case 'set': {
        if (!['LEADER', 'OFFICER'].includes(member.role as ValidRole)) {
          await interaction.reply({
            content: 'Only leaders and officers can modify radio settings.',
            ephemeral: true
          });
          return;
        }

        const frequency = interaction.options.getString('frequency', true);
        
        // Validate frequency format (e.g., "123.45")
        if (!/^\d{3}\.\d{2}$/.test(frequency)) {
          await interaction.reply({
            content: 'Invalid frequency format. Please use format: "123.45"',
            ephemeral: true
          });
          return;
        }

        const { error } = await supabase
          .from('factions')
          .update({
            radio_frequency: frequency,
            radio_updated_at: new Date().toISOString(),
            radio_updated_by: interaction.user.id
          })
          .eq('id', faction.id);

        if (error) {
          logger.error('Error updating radio frequency:', error);
          await interaction.reply({
            content: 'An error occurred while updating the radio frequency.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('📻 Radio Frequency Updated')
          .setDescription(`New frequency: ${frequency}`)
          .addFields(
            { name: 'Updated by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Updated at', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        break;
      }

      case 'view': {
        if (!faction.radio_frequency) {
          await interaction.reply({
            content: 'No radio frequency has been set for this faction.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📻 Radio Information')
          .setDescription(`Current frequency: ${faction.radio_frequency}`)
          .addFields(
            faction.radio_updated_by ? 
              { name: 'Last updated by', value: `<@${faction.radio_updated_by}>`, inline: true } : null,
            faction.radio_updated_at ? 
              { name: 'Last updated', value: `<t:${Math.floor(new Date(faction.radio_updated_at).getTime() / 1000)}:R>`, inline: true } : null
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
    logger.error('Error in radio command:', error);
    await interaction.reply({
      content: 'An error occurred while processing the radio command.',
      ephemeral: true
    });
  }
}

module.exports = { handleRadio };