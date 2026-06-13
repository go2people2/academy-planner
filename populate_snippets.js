const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const defaultSnippets = [
    "[숙제이행: 1단계]",
    "[숙제이행: 2단계]",
    "[숙제이행: 3단계]",
    "[숙제이행: 4단계]",
    "[숙제이행: 5단계]",
    "[숙제미흡]",
    "[오답정리필요]",
    "[개념보충필요]",
    "[테스트통과]",
    "[테스트미통과]"
  ];

  const presets = {
    snippets: defaultSnippets,
    snippet_trigger: ';'
  };

  const { error } = await supabase
    .from('ams_teachers')
    .update({ homework_presets: presets })
    .eq('id', '5466ec71-de32-4b45-8646-1fe1c0a1f2e6'); // 원장님 계정

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Successfully populated default snippets.');
  }
}
run();
