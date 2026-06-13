const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/joonsik_air/documents/makecode/academy-planner/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: surveyData, error } = await supabase
    .from('ams_tasks')
    .select('*')
    .eq('academy_id', 'aa57bded-2adb-459f-a51b-79d8e033008a')
    .eq('type', 'survey');

  console.log('Surveys error:', error);
  console.log('Surveys count:', surveyData?.length);
  if (surveyData) {
    surveyData.forEach(s => {
      console.log('Survey:', s.title);
      console.log('Content:', s.content);
    });
  }
}

run();
