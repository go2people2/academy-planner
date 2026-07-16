'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Student } from '@/types/dashboard';
import { Sparkles, Loader2, Save, AlertCircle, Cpu } from 'lucide-react';

interface AIConsultationBriefingProps {
  student: Student;
  onBriefingSaved?: () => void;
  isLight?: boolean;
}

export default function AIConsultationBriefing({ student, onBriefingSaved, isLight = false }: AIConsultationBriefingProps) {
  const [activeModels, setActiveModels] = useState<string[]>(['openai']);
  const [selectedModel, setSelectedModel] = useState<string>('openai');
  const [briefings, setBriefings] = useState<Record<string, string>>({});
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // 💡 분석 대상 기간 상태 추가
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 날짜 초기화 (최근 1개월)
  useEffect(() => {
    const todayKST = new Date(Date.now() + 9 * 3600 * 1000);
    const end = todayKST.toISOString().split('T')[0];
    const start = new Date(todayKST.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
  }, []);

  // 1. 학원 설정을 로드하여 활성화된 AI 모델 세팅
  useEffect(() => {
    async function loadAcademySettings() {
      try {
        const { data, error } = await supabase
          .from('ams_academies')
          .select('operation_settings')
          .eq('id', student.academy_id)
          .maybeSingle();

        if (!error && data?.operation_settings?.ai_settings) {
          const aiSettings = data.operation_settings.ai_settings;
          const models = Array.isArray(aiSettings.active_models) ? aiSettings.active_models : ['openai'];
          setActiveModels(models);
          setSelectedModel(aiSettings.default_model || models[0] || 'openai');
        }
      } catch (err) {
        console.error('Failed to load academy settings for AI:', err);
      }
    }
    if (student?.academy_id) {
      loadAcademySettings();
    }
  }, [student?.academy_id]);

  // 2. AI 브리핑 리포트 생성 API 호출
  const handleGenerateBriefing = async (model: string) => {
    setLoadingModel(model);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, model, startDate, endDate })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '상담 브리핑 생성에 실패했습니다.');
      }

      setBriefings((prev) => ({
        ...prev,
        [model]: data.briefing
      }));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '상담 브리핑 생성 도중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoadingModel(null);
    }
  };

  // 3. 생성된 리포트를 상담 일지 테이블에 저장
  const handleSaveToConsultation = async () => {
    const currentBriefing = briefings[selectedModel];
    if (!currentBriefing || isSaving) return;

    setIsSaving(true);
    try {
      const todayKST = new Date(Date.now() + 9 * 3600 * 1000);
      const dateStr = todayKST.toISOString().split('T')[0].replace(/-/g, '.'); // "2026.07.11" 형식

      const { error } = await supabase
        .from('ams_consultations')
        .insert({
          student_id: student.id,
          academy_id: student.academy_id,
          date: dateStr,
          content: `🤖 [AI ${selectedModel.toUpperCase()} 분석 리포트]\n\n${currentBriefing.trim()}`
        });

      if (error) throw error;

      // 오늘 날짜로 상담했으므로 학생 테이블의 last_consulted_at 업데이트
      const todayStr = todayKST.toISOString().split('T')[0];
      await supabase
        .from('ams_students')
        .update({ last_consulted_at: todayStr })
        .eq('id', student.id);

      alert('AI 상담 리포트가 성공적으로 상담 일지에 저장되었습니다!');

      if (onBriefingSaved) {
        onBriefingSaved();
      }
    } catch (err: any) {
      console.error('Failed to save briefing to consultation:', err);
      alert('상담 일지 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 💡 간단한 마크다운 파싱 헬퍼 함수
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    return text.split('\n').map((line, idx) => {
      // H3 헤더 (###)
      if (line.startsWith('###')) {
        const title = line.replace('###', '').trim();
        return (
          <h3 key={idx} className={`text-xs font-black mt-5 mb-2.5 pb-1 border-b uppercase tracking-wider flex items-center gap-1.5 ${
            isLight ? 'text-amber-700 border-gray-200' : 'text-amber-500 border-white/5'
          }`}>
            <Sparkles size={11} className={isLight ? 'text-amber-600' : 'text-amber-500'} />
            {title}
          </h3>
        );
      }
      // 리스트 (-)
      if (line.startsWith('-')) {
        const item = line.replace(/^-/, '').trim();
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
            <span className={`${isLight ? 'text-blue-600' : 'text-blue-500'} mt-1 select-none`}>•</span>
            <p className={`text-[11px] font-bold leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{item}</p>
          </div>
        );
      }
      // 일반 줄바꿈
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      // 일반 텍스트 문단
      return (
        <p key={idx} className={`text-[11px] font-bold leading-relaxed ${isLight ? 'text-gray-650' : 'text-gray-400'}`}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className="space-y-5">
      {/* 🤖 상단 헤더 영역 */}
      <div className={`rounded-[4px] p-4 flex items-center gap-3 border ${
        isLight 
          ? 'bg-blue-50/50 border-blue-100 text-blue-900' 
          : 'bg-blue-600/5 border-blue-500/10 text-white/90'
      }`}>
        <div className={`w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0 shadow-lg border ${
          isLight 
            ? 'bg-blue-100 border-blue-200 text-blue-600' 
            : 'bg-blue-600/10 border-blue-500/20 text-blue-400'
        }`}>
          <Cpu size={20} />
        </div>
        <div>
          <h4 className="text-xs font-black">AI 학부모 상담 브리핑 생성기</h4>
          <p className={`text-[9px] font-bold mt-0.5 leading-relaxed ${
            isLight ? 'text-blue-700/80' : 'text-gray-500'
          }`}>
            수업 일지와 정기 고사 성적을 결합하여 AI가 입체적인 분석을 제공합니다.
          </p>
        </div>
      </div>

      {/* 📅 분석 대상 기간 선택 필터 */}
      <div className={`rounded-[4px] p-4 space-y-2.5 border ${
        isLight 
          ? 'bg-gray-50/50 border-gray-200' 
          : 'bg-[#111111]/80 border border-white/5'
      }`}>
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">📅 AI 분석 대상 기간 설정</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 font-bold block uppercase">시작일</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-[11px] outline-none font-bold ${
                isLight 
                  ? 'bg-white border-gray-250 text-gray-800 [color-scheme:light]' 
                  : 'bg-black/40 border border-white/5 text-white [color-scheme:dark] focus:border-blue-500/50'
              }`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 font-bold block uppercase">종료일</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full border rounded-[2px] px-2.5 py-1.5 text-[11px] outline-none font-bold ${
                isLight 
                  ? 'bg-white border-gray-250 text-gray-800 [color-scheme:light]' 
                  : 'bg-black/40 border border-white/5 text-white [color-scheme:dark] focus:border-blue-500/50'
              }`}
            />
          </div>
        </div>
      </div>

      {/* ⚙️ 모델 탭 전환 */}
      <div className={`flex gap-1.5 pb-2 border-b ${
        isLight ? 'border-gray-200' : 'border-white/5'
      }`}>
        {activeModels.map((model) => (
          <button
            key={model}
            onClick={() => setSelectedModel(model)}
            className={`px-3 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all border ${
              selectedModel === model
                ? isLight
                  ? 'bg-blue-50 text-blue-600 border-blue-600/30'
                  : 'bg-blue-600/10 text-blue-400 border-blue-500/30'
                : isLight
                  ? 'bg-transparent text-gray-400 border-transparent hover:text-gray-650'
                  : 'bg-transparent text-gray-500 border-transparent hover:text-gray-400'
            }`}
          >
            {model === 'openai' ? 'OpenAI GPT-4o' : 'Google Gemini Pro'}
          </button>
        ))}
      </div>

      {/* 🖥️ 본문 리포트 뷰 */}
      <div className={`rounded-[4px] p-5 min-h-[250px] flex flex-col justify-between border ${
        isLight 
          ? 'bg-white border-gray-200 shadow-sm text-gray-800' 
          : 'bg-black/20 border border-white/5 text-white'
      }`}>
        <div>
          {errorMsg && (
            <div className={`flex items-center gap-2 p-3 border rounded text-[10px] font-black ${
              isLight 
                ? 'bg-red-50 border-red-100 text-red-700' 
                : 'bg-red-500/5 border-red-500/10 text-red-400'
            }`}>
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {briefings[selectedModel] ? (
            <div className="space-y-3 prose prose-invert max-w-none">
              {renderMarkdown(briefings[selectedModel])}
            </div>
          ) : loadingModel === selectedModel ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">
                {selectedModel.toUpperCase()}가 학생 데이터를 정밀 분석 중...
              </span>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest italic">
                생성된 AI 상담 리포트가 없습니다
              </p>
              <button
                onClick={() => handleGenerateBriefing(selectedModel)}
                className="mx-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30 flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                {selectedModel === 'openai' ? 'GPT-4o로 분석 시작' : 'Gemini Pro로 분석 시작'}
              </button>
            </div>
          )}
        </div>

        {/* 💾 저장 및 재생성 영역 */}
        {briefings[selectedModel] && !loadingModel && (
          <div className={`pt-4 mt-6 flex justify-between gap-3 border-t ${
            isLight ? 'border-gray-150' : 'border-white/5'
          }`}>
            <button
              onClick={() => handleGenerateBriefing(selectedModel)}
              className={`px-3.5 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all border ${
                isLight 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-650 border-gray-200' 
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/5'
              }`}
            >
              다시 생성하기
            </button>
            <button
              onClick={handleSaveToConsultation}
              disabled={isSaving}
              className={`px-4 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none border ${
                isLight 
                  ? 'bg-amber-600/10 text-amber-700 border-amber-600/20 hover:bg-amber-600 hover:text-white' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-50 hover:text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save size={12} />
                  상담 일지에 기록 저장
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
