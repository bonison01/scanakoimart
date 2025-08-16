// services/supabaseService.ts
import { supabase } from '../supabase/supabaseClient';

export const saveContactToSupabase = async (data: any): Promise<{ error: any }> => {
  const { error } = await supabase.from('contacts').insert([data]);
  return { error };
};
