import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ valid: false, message: 'Method not allowed' });
  }

  try {
    const { licence_key } = req.body || {};
    if (!licence_key) {
      return res.status(400).json({ valid: false, message: 'licence_key is required' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('licence_key', licence_key)
      .limit(1)
      .single();

    if (error) {
      // If no rows found, return valid: false
      // Supabase may return an error for no rows depending on client; handle generically
      console.error('Supabase error in verify-key:', error.message || error);
      return res.status(200).json({ valid: false, message: 'Licence not found' });
    }

    if (data && data.id) {
      return res.status(200).json({ valid: true, message: 'Licence found' });
    }

    return res.status(200).json({ valid: false, message: 'Licence not found' });
  } catch (err) {
    console.error('Unexpected error in verify-key:', err);
    return res.status(500).json({ valid: false, message: 'Internal server error' });
  }
}
