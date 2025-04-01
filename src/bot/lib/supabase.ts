import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import logger from './logger.js';

config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});