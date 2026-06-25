// supabase/functions/generate-student-token/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { studentId } = await req.json();

    if (!studentId) {
      throw new Error('studentId is required.');
    }

    // Supabase Admin 클라이언트를 사용하여 서비스 역할 키로 인증
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 학생이 실제로 존재하는지 확인 (필요시)
    const { data: student, error: studentError } = await supabaseAdmin
      .from('student_users')
      .select('id, name, teacher_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: 'Student not found or database error.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // `service_role` 키를 사용하여 해당 학생을 위한 세션을 생성합니다.
    // generateLink의 type: 'token'을 사용하여 바로 access_token을 얻습니다.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'token',
      // userId는 학생의 Supabase Auth user ID여야 합니다.
      // 만약 student_users 테이블에 user_id 컬럼이 없다면,
      // student_users의 id를 user_id로 사용하거나 (이 경우 학생 ID가 Supabase Auth User ID와 동일해야 함)
      // 별도로 user_id를 가져오는 로직이 필요합니다.
      // 일단 student.id를 userId로 가정합니다.
      // 또한, 'user_metadata'는 generateLink 시 'action_link'와 함께 사용될 때 의미가 있습니다.
      // 여기서는 토큰만 생성하므로 metadata를 직접 추가할 필요는 없습니다.
      // 토큰 내부의 user_metadata는 `student_users` 테이블에 직접 연결된 Supabase Auth user_metadata를 사용하게 됩니다.
      // generateLink는 실제 user를 만들거나 수정하지 않으므로, 여기서는 단순히 토큰을 얻는 데 집중합니다.
      properties: {
        userId: student.id, // Supabase Auth user ID
      },
    });

    if (authError) {
      console.error('Error generating auth token:', authError);
      throw new Error(`Failed to generate auth token: ${authError.message}`);
    }

    if (!authData || !authData.properties?.token) {
      throw new Error('Auth token not returned from generateLink.');
    }

    // generateLink에서 반환된 토큰은 `access_token`입니다.
    const token = authData.properties.token;

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});