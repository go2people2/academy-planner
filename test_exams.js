require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: students } = await supabase.from('ams_students').select('id, name, school, grade');
  const { data: exams } = await supabase.from('ams_exam_schedules').select('*');
  
  console.log("Exams:");
  console.log(exams);
  console.log("Students sample:");
  console.log(students.slice(0, 5));
}
check();
