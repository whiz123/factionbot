import type { SupabaseClient } from '@supabase/supabase-js';
const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const logger = require('./logger');

config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = { supabase };