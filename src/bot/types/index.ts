import { ChatInputCommandInteraction } from 'discord.js';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  userId: string;
}

export interface CommandHandler {
  execute: (context: CommandContext) => Promise<void>;
  cooldown?: number; // Cooldown in seconds
}

export interface Faction {
  id: string;
  name: string;
  discord_guild_id: string;
  prefix: string;
  timezone: string;
  admin_role_id?: string;
  fine_role_id?: string;
}