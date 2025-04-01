import type { ChatInputCommandInteraction, Message } from 'discord.js';
const { EmbedBuilder } = require('discord.js');
const { supabase } = require('../lib/supabase');
const logger = require('../lib/logger');
const { addMinutes } = require('date-fns');

interface FactionMember {
  id: string;
  faction_id: string;
  discord_user_id: string;
  role: string;
}

interface Faction {
  id: string;
  voting_channel_id: string;
}

interface PollOption {
  emoji: string;
  text: string;
  votes: number;
}

const EMOJI_LIST = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function handlePoll(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Create poll options with emojis
    const pollOptions: PollOption[] = options.map((text, index) => ({
      emoji: EMOJI_LIST[index],
      text,
      votes: 0
    }));

    const endTime = addMinutes(new Date(), duration);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📊 ' + question)
      .setDescription(
        pollOptions
          .map(opt => `${opt.emoji} ${opt.text}`)
          .join('\n\n') +
        `\n\nPoll ends: <t:${Math.floor(endTime.getTime() / 1000)}:R>`
      )
      .setFooter({
        text: `Created by ${interaction.user.tag} • React with the emojis to vote!`
      });

    // Create the poll in the database
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        faction_id: faction.id,
        creator_id: interaction.user.id,
        question,
        options: pollOptions,
        end_time: endTime.toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating poll:', error);
      await interaction.reply({
        content: 'An error occurred while creating the poll.',
        ephemeral: true
      });
      return;
    }

    // Send poll message
    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true
    }) as Message;

    // Add reaction options
    for (const option of pollOptions) {
      await message.react(option.emoji);
    }

    // Create collector for reactions
    const filter = (_: unknown, user: { id: string }) => user.id !== interaction.client.user?.id;
    const collector = message.createReactionCollector({
      filter,
      time: duration * 60 * 1000
    });

    // Track votes
    const votes = new Map<string, string>();

    collector.on('collect', async (reaction, user) => {
      const emoji = reaction.emoji.name;
      if (!emoji || !EMOJI_LIST.includes(emoji)) return;

      // Remove other reactions from this user
      const previousVote = votes.get(user.id);
      if (previousVote && previousVote !== emoji) {
        const previousReaction = message.reactions.cache.find(r => r.emoji.name === previousVote);
        await previousReaction?.users.remove(user.id);
      }

      votes.set(user.id, emoji);

      // Update vote counts
      const updatedOptions = pollOptions.map(opt => ({
        ...opt,
        votes: message.reactions.cache.get(opt.emoji)?.count ?? 0
      }));

      // Update poll in database
      await supabase
        .from('polls')
        .update({
          options: updatedOptions,
          votes: Object.fromEntries(votes)
        })
        .eq('id', poll.id);
    });

    collector.on('end', async () => {
      const finalOptions = pollOptions.map(opt => ({
        ...opt,
        votes: message.reactions.cache.get(opt.emoji)?.count ?? 0
      }));

      const totalVotes = finalOptions.reduce((sum, opt) => sum + opt.votes, 0);
      const winner = finalOptions.reduce((prev, curr) => 
        curr.votes > prev.votes ? curr : prev
      );

      const resultsEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 Poll Results: ' + question)
        .setDescription(
          finalOptions
            .map(opt => 
              `${opt.emoji} ${opt.text}\n` +
              `Votes: ${opt.votes} (${Math.round((opt.votes / totalVotes) * 100)}%)`
            )
            .join('\n\n') +
          `\n\n**Winner:** ${winner.text} with ${winner.votes} votes!`
        )
        .setFooter({
          text: `Poll ended • Total votes: ${totalVotes}`
        });

      await message.edit({ embeds: [resultsEmbed] });
      await message.reactions.removeAll();

      // Update final results in database
      await supabase
        .from('polls')
        .update({
          options: finalOptions,
          ended: true,
          winner: winner.text
        })
        .eq('id', poll.id);
    });
  } catch (error: unknown) {
    logger.error('Error in poll command:', error);
    await interaction.reply({
      content: 'An error occurred while creating the poll.',
      ephemeral: true
    });
  }
}

module.exports = { handlePoll };