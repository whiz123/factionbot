import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

export async function handleRadio(interaction: ChatInputCommandInteraction) {
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
        if (!['LEADER', 'OFFICER'].includes(member.role)) {
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
          .from('radio_settings')
          .upsert({
            faction_id: faction.id,
            frequency,
            format: 'FM'
          });

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('📻 Radio Frequency Updated')
          .setDescription(`Frequency set to: ${frequency} FM`)
          .setTimestamp();

        if (faction.radio_channel_id) {
          const channel = interaction.guild?.channels.cache.get(faction.radio_channel_id);
          if (channel?.isTextBased()) {
            await channel.send({ embeds: [embed] });
          }
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'announce': {
        const message = interaction.options.getString('message', true);
        
        // Get radio settings
        const { data: radioSettings } = await supabase
          .from('radio_settings')
          .select()
          .eq('faction_id', faction.id)
          .single();

        if (!radioSettings) {
          await interaction.reply({
            content: 'Radio frequency has not been set. Ask a leader or officer to set it first.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📻 Radio Announcement')
          .setDescription(message)
          .addFields(
            { name: 'Frequency', value: `${radioSettings.frequency} ${radioSettings.format}`, inline: true },
            { name: 'From', value: interaction.user.tag, inline: true }
          )
          .setTimestamp();

        if (faction.radio_channel_id) {
          const channel = interaction.guild?.channels.cache.get(faction.radio_channel_id);
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
    logger.error('Error in radio command:', error);
    await interaction.reply({
      content: 'There was an error while managing radio settings. Please try again later.',
      ephemeral: true
    });
  }
}