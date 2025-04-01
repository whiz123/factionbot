import type { ChatInputCommandInteraction } from 'discord.js';

export type CommandContext = {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  userId: string;
};

export type CommandHandler = {
  name: string;
  description: string;
  execute: (context: CommandContext) => Promise<void>;
  cooldown?: number;
};

export type Faction = {
  id: string;
  name: string;
  discord_guild_id: string;
  created_at: string;
  admin_role_id?: string;
  fine_role_id?: string;
};