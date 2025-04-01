import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';
import { addMinutes } from 'date-fns';

export async function handlePoll(interaction: ChatInputCommandInteraction) {
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
        content: 'You must be a faction member to create polls.',
        ephemeral: true
      });
      return;
    }

    const question = interaction.options.getString('question', true);
    const optionsString = interaction.options.getString('options', true);
    const duration = interaction.options.getNumber('duration') ?? 60; // Default 60 minutes
    const options = optionsString.split(',').map(opt => opt.trim());

    if (options.length < 2 || options.length > 10) {
      await interaction.reply({
        content: 'Please provide between 2 and 10 options.',
        ephemeral: true
      });
      return;
    }

    const endsAt = addMinutes(new Date(), duration);

    // Create poll in database
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        faction_id: faction.id,
        question,
        options,
        created_by_user_id: interaction.user.id,
        ends_at: endsAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const pollOptions = options.map((opt, i) => `${reactions[i]} ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(pollOptions)
      .addFields(
        { name: 'Created By', value: interaction.user.tag, inline: true },
        { name: 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: 'Poll ID', value: poll.id, inline: true }
      )
      .setFooter({ text: 'React with the corresponding number to vote!' })
      .setTimestamp();

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true
    });

    // Add reaction options
    for (let i = 0; i < options.length; i++) {
      await message.react(reactions[i]);
    }

    // Set up collector for votes
    const filter = (reaction: any) => reactions.slice(0, options.length).includes(reaction.emoji.name);
    const collector = message.createReactionCollector({ 
      filter, 
      time: duration * 60 * 1000 
    });

    collector.on('collect', async (reaction, user) => {
      if (user.bot) return;

      const optionIndex = reactions.indexOf(reaction.emoji.name!);

      try {
        // Record vote in database
        await supabase
          .from('poll_votes')
          .upsert({
            poll_id: poll.id,
            discord_user_id: user.id,
            option_index: optionIndex
          });
      } catch (error) {
        logger.error('Error recording poll vote:', error);
      }
    });

    collector.on('end', async () => {
      try {
        // Get final vote counts
        const { data: votes } = await supabase
          .from('poll_votes')
          .select('option_index')
          .eq('poll_id', poll.id);

        const voteCounts = options.map((_, i) => 
          votes?.filter(v => v.option_index === i).length ?? 0
        );

        const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
        const results = options.map((opt, i) => {
          const count = voteCounts[i];
          const percentage = totalVotes > 0 ? (count / totalVotes * 100).toFixed(1) : '0.0';
          return `${reactions[i]} ${opt}\n└ ${count} votes (${percentage}%)`;
        }).join('\n\n');

        const resultsEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`📊 Poll Results: ${question}`)
          .setDescription(results)
          .addFields(
            { name: 'Total Votes', value: totalVotes.toString(), inline: true },
            { name: 'Status', value: '✅ Closed', inline: true }
          )
          .setTimestamp();

        await message.reply({ embeds: [resultsEmbed] });
      } catch (error) {
        logger.error('Error handling poll end:', error);
      }
    });
  } catch (error) {
    logger.error('Error in poll command:', error);
    await interaction.reply({
      content: 'There was an error while creating the poll. Please try again later.',
      ephemeral: true
    });
  }
}