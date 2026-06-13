'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types/dashboard';

interface SurveyListProps {
  academyId: string;
  student: Student;
}

export default function SurveyList({ academyId, student }: SurveyListProps) {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [responses, setResponses] = useState<string[]>([]); // 응답한 설문 ID 목록
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // 답변 상태 (주관식/객관식)
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSurveys();
  }, [academyId, student.id]);

  const fetchSurveys = async () => {
    // 1. 활성화된 수요조사 조회
    const { data: surveyData } = await supabase
      .from('ams_tasks')
      .select('*')
      .eq('academy_id', academyId)
      .eq('type', 'survey')
      .order('created_at', { ascending: false });

    if (!surveyData || surveyData.length === 0) return;

    // 타겟 학생 필터링
    const targetSurveys = surveyData.filter(survey => {
      try {
        const sData = JSON.parse(survey.content || '{}');
        // target_students가 없거나 빈 배열이면 전체 대상, 있으면 포함된 학생만
        if (sData.target_students && Array.isArray(sData.target_students)) {
          if (sData.target_students.length > 0 && !sData.target_students.includes(student.id)) {
            return false;
          }
        }
      } catch (e) {}
      return true;
    });

    setSurveys(targetSurveys);

    // 2. 학생이 응답한 내역 조회
    const { data: responseData } = await supabase
      .from('ams_tasks')
      .select('title') // title에 survey.id 저장됨
      .eq('academy_id', academyId)
      .eq('type', 'survey_response')
      .ilike('content', `%${student.id}%`);

    if (responseData) {
      setResponses(responseData.map(r => r.title));
    }
  };

  const handleSelectOption = (surveyId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [surveyId]: option }));
  };

  const handleSubmit = async (survey: any) => {
    const answer = answers[survey.id];
    if (!answer) {
      alert('답변을 선택하거나 입력해주세요!');
      return;
    }

    setSubmittingId(survey.id);

    const contentObj = {
      student_id: student.id,
      response: answer
    };

    const { error } = await supabase.from('ams_tasks').insert([{
      academy_id: academyId,
      title: survey.id, // 참조용
      content: JSON.stringify(contentObj),
      start_date: new Date().toISOString().split('T')[0],
      target_date: new Date().toISOString().split('T')[0],
      display_period_type: 'custom',
      is_completed: true,
      created_by: null,
      type: 'survey_response'
    }]);

    if (!error) {
      setResponses(prev => [...prev, survey.id]);
    } else {
      alert(`제출 오류: ${error.message}`);
    }
    
    setSubmittingId(null);
  };

  if (surveys.length === 0) return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
      <ClipboardList size={28} className="text-gray-600 mx-auto mb-3" />
      <p className="text-sm font-bold text-gray-400">진행 중인 설문이 없습니다</p>
      <p className="text-xs text-gray-600 mt-1">새로운 설문이 등록되면 여기에 표시됩니다</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {surveys.map(survey => {
        const isAnswered = responses.includes(survey.id);
        let sData: any = {};
        try { sData = JSON.parse(survey.content || '{}'); } catch(e){}

        return (
          <div key={survey.id} className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 md:p-6 text-left shadow-lg shadow-purple-900/10">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className={isAnswered ? "text-gray-500" : "text-purple-400"} />
              <h3 className={`text-sm font-bold ${isAnswered ? 'text-gray-500' : 'text-purple-100'}`}>{survey.title}</h3>
            </div>

            {isAnswered ? (
              <div className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">응답이 완료되었습니다</span>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {sData.type === 'objective' && sData.options ? (
                  <div className="grid grid-cols-2 gap-2">
                    {sData.options.map((opt: string) => (
                      <button
                        key={opt}
                        onClick={() => handleSelectOption(survey.id, opt)}
                        className={`p-2 rounded border text-xs font-bold transition-all ${
                          answers[survey.id] === opt 
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg' 
                            : 'bg-black/30 border-white/10 text-gray-400 hover:border-purple-500/30 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    placeholder="답변을 입력해주세요..."
                    value={answers[survey.id] || ''}
                    onChange={(e) => handleSelectOption(survey.id, e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none resize-none"
                    rows={2}
                  />
                )}

                <button
                  onClick={() => handleSubmit(survey)}
                  disabled={submittingId === survey.id || !answers[survey.id]}
                  className={`w-full py-2.5 rounded text-xs font-black uppercase tracking-widest transition-all ${
                    submittingId === survey.id || !answers[survey.id]
                      ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                      : 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-500'
                  }`}
                >
                  {submittingId === survey.id ? '제출 중...' : '제출하기'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
