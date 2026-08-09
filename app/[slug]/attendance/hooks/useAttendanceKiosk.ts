import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RecentRecord {
  studentName: string;
  type: '등원' | '하원';
  status?: string;
  time: string;
}

export type FeedbackState = 'idle' | 'success-checkin' | 'success-late' | 'success-checkout' | 'success-teacher-in' | 'success-teacher-out' | 'error' | 'duplicate' | 'already-done';

export function getNowKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const day = days[kst.getUTCDay()];
  return `${y}년 ${mo}월 ${d}일 ${day}`;
}

export function getNowKSTTimeString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  const s = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${h}:${mi}:${s}`;
}

export function useAttendanceKiosk(slugStr: string) {
  const [digits, setDigits] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSub, setFeedbackSub] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyPhone, setReplyPhone] = useState('0322620911');
  const [footerMemo, setFooterMemo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    setDateText(getNowKSTDateString());
    setTimeText(getNowKSTTimeString());
    const id = setInterval(() => {
      setDateText(getNowKSTDateString());
      setTimeText(getNowKSTTimeString());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const loadInfo = useCallback(async () => {
    if (!slugStr) return;
    try {
      const res = await fetch(`/api/attendance?slug=${slugStr}`);
      if (!res.ok) return;
      const data = await res.json();
      const loadedAcademyName = data.academyName || '';
      setAcademyName(loadedAcademyName);
      setRecentRecords(data.recentRecords || []);

      if (data.operationSettings && data.operationSettings.naver_cafe_title) {
        setFooterMemo(data.operationSettings.naver_cafe_title);
      } else {
        setFooterMemo(loadedAcademyName);
      }
    } catch {}
  }, [slugStr]);

  useEffect(() => {
    loadInfo();

    const channel = supabase
      .channel('kiosk-attendance-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ams_session_logs'
        },
        () => {
          loadInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInfo]);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (window.performance && window.performance.navigation.type === 2)) {
        setDigits('');
        setFeedback('idle');
        setFeedbackMsg('');
        setFeedbackSub('');
        setIsSubmitting(false);
        loadInfo();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [loadInfo]);

  useEffect(() => {
    const handleUnload = () => {};
    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, []);

  const resetFeedback = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setFeedback('idle');
      setFeedbackMsg('');
      setFeedbackSub('');
      setDigits('');
    }, 3000);
  }, []);

  const handleKey = useCallback((key: string) => {
    if (feedback !== 'idle') return;
    if (key === 'clear') {
      setDigits('');
      return;
    }
    if (key === 'backspace') {
      setDigits(prev => prev.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    setDigits(prev => prev + key);
  }, [digits, feedback]);

  const handleSubmit = useCallback(async () => {
    if (digits.length !== 4 || isSubmitting || feedback !== 'idle') return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugStr, digits }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.isTeacher) {
          if (data.type === '출근') {
            setFeedback('success-teacher-in');
            setFeedbackMsg(`${data.teacherName} 선생님`);
            setFeedbackSub(`출근 완료 · ${data.time}`);
          } else {
            setFeedback('success-teacher-out');
            setFeedbackMsg(`${data.teacherName} 선생님`);
            setFeedbackSub(`퇴근 완료 · ${data.time} (근무: ${data.duration}분)`);
          }
        } else {
          if (data.type === '하원') {
            setFeedback('success-checkout');
            setFeedbackMsg(`${data.studentName} 학생`);
            setFeedbackSub(`하원 · ${data.time}`);
          } else {
            const isLate = data.attendanceStatus === '지각';
            setFeedback(isLate ? 'success-late' : 'success-checkin');
            setFeedbackMsg(`${data.studentName} 학생`);
            setFeedbackSub(`${data.attendanceStatus} · ${data.time}`);
          }
        }
        await loadInfo();
        resetFeedback();
      } else if (res.status === 409) {
        setFeedback('already-done');
        setFeedbackMsg(data.error || '이미 완료되었습니다.');
        setFeedbackSub('관리자에게 문의해주세요');
        resetFeedback();
      } else {
        setFeedback('error');
        setFeedbackMsg(data.error || '등록된 정보를 찾을 수 없습니다.');
        setFeedbackSub('다시 시도해주세요');
        resetFeedback();
      }
    } catch {
      setFeedback('error');
      setFeedbackMsg('네트워크 오류가 발생했습니다');
      setFeedbackSub('다시 시도해주세요');
      resetFeedback();
    } finally {
      setIsSubmitting(false);
    }
  }, [digits, isSubmitting, feedback, slugStr, loadInfo, resetFeedback]);

  const handleUndo = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!digits || digits.length !== 4 || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugStr, digits }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFeedback('error');
        setFeedbackMsg(`${data.studentName || '출결'} 취소 완료`);
        setFeedbackSub(`직전 ${data.type || '기록'} 상태가 취소되었습니다.`);
        await loadInfo();
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
          setFeedback('idle');
          setFeedbackMsg('');
          setFeedbackSub('');
          setDigits('');
        }, 3000);
      } else {
        alert(data.error || '취소할 직전 출결 기록을 찾을 수 없습니다.');
      }
    } catch {
      alert('네트워크 오류로 취소에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [digits, isSubmitting, slugStr, loadInfo]);

  return {
    digits,
    setDigits,
    academyName,
    recentRecords,
    dateText,
    timeText,
    feedback,
    feedbackMsg,
    feedbackSub,
    isSubmitting,
    replyPhone,
    footerMemo,
    isModalOpen,
    setIsModalOpen,
    searchTerm,
    setSearchTerm,
    isFullscreen,
    toggleFullscreen,
    handleKey,
    handleSubmit,
    handleUndo,
  };
}
