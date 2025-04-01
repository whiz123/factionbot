import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';





export async function handleConfig(interaction: ChatInputCommandInteraction) {
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
        flags: 64
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
        content: 'You do not have permission to modify faction settings.',
        flags: 64
      });
      return;
    }

    switch (subcommand) {
      case 'prefix': {
        const prefix = interaction.options.getString('prefix', true);
        
        if (prefix.length > 10) {
          await interaction.reply({
            content: 'Prefix must be 10 characters or less.',
            flags: 64
          });
          return;
        }

        const { error } = await supabase
          .from('factions')
          .update({ prefix })
          .eq('id', faction.id);

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Prefix Updated')
          .setDescription(`Faction prefix has been set to: \`${prefix}\``)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'admin': {
        const role = interaction.options.getRole('role', true);
        
        const { error } = await supabase
          .from('factions')
          .update({ admin_role_id: role.id })
          .eq('id', faction.id);

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Admin Role Updated')
          .setDescription(`Admin role has been set to: ${role.name}`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'timezone': {
        const timezone = interaction.options.getString('timezone', true);
        
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
        

        const { error } = await supabase
          .from('factions')
          .update({ timezone })
          .eq('id', faction.id);

        if (error) throw error;

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('Timezone Updated')
          .setDescription(`Faction timezone has been set to: \`${timezone}\``)
          .addFields({
            name: 'Current Time',
            value: new Date().toLocaleString('en-US', { timeZone: timezone })
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({
          content: 'Invalid subcommand',
          flags: 64
        });
    }
  } catch (error) {
    logger.error('Error in config command:', error);
    await interaction.reply({
      content: 'There was an error while updating configuration. Please try again later.',
      flags: 64
    });
  }
}