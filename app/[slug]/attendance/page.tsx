'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface RecentRecord {
  studentName: string;
  type: '등원' | '하원';
  status?: string;
  time: string;
}

type FeedbackState = 'idle' | 'success-checkin' | 'success-late' | 'success-checkout' | 'success-teacher-in' | 'success-teacher-out' | 'error' | 'duplicate' | 'already-done';

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const m = String(kst.getUTCMinutes()).padStart(2, '0');
    const s = String(kst.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return isoString;
  }
}

function getNowKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const day = days[kst.getUTCDay()];
  return `${y}년 ${mo}월 ${d}일 ${day}`;
}

function getNowKSTTimeString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  const s = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${h}:${mi}:${s}`;
}

export default function AttendancePage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug || '';

  const [digits, setDigits] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSub, setFeedbackSub] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyPhone, setReplyPhone] = useState('0322620911'); // 기본 회신번호
  const [footerMemo, setFooterMemo] = useState('호크마수학학원'); // 기본 꼬릿말
  const [isModalOpen, setIsModalOpen] = useState(false); // 💡 전체기록 팝업 상태 추가
  const [searchTerm, setSearchTerm] = useState(''); // 💡 실시간 이름 검색어 상태 추가
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

  // 시계 업데이트
  useEffect(() => {
    setDateText(getNowKSTDateString());
    setTimeText(getNowKSTTimeString());
    const id = setInterval(() => {
      setDateText(getNowKSTDateString());
      setTimeText(getNowKSTTimeString());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // 학원 정보 + 최근 출결 로드
  const loadInfo = useCallback(async () => {
    if (!slugStr) return;
    try {
      const res = await fetch(`/api/attendance?slug=${slugStr}`);
      if (!res.ok) return;
      const data = await res.json();
      setAcademyName(data.academyName || '');
      setRecentRecords(data.recentRecords || []);

      if (data.operationSettings) {
        if (data.operationSettings.naver_cafe_title) {
          setFooterMemo(data.operationSettings.naver_cafe_title);
        }
        // 회신 번호 등 설정값이 있다면 연동 가능
      }
    } catch {}
  }, [slugStr]);

  useEffect(() => {
    loadInfo();

    // 💡 [실시간 동기화] ams_session_logs 테이블의 변화를 감지하여 즉시 동기화
    const channel = supabase
      .channel('kiosk-attendance-sync')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모두 감지
          schema: 'public',
          table: 'ams_session_logs'
        },
        () => {
          // 데이터가 실제로 바뀌었을 때만 API를 호출해 목록 갱신
          loadInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInfo]);

  // 💡 [뒤로가기 대응 1단계] 브라우저 뒤로가기(BFCache) 복원 시 먹통이 되지 않도록 상태 클린 리셋
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      // e.persisted가 true이거나 브라우저 뒤로가기(Back/Forward) 복원 상황일 때 리셋
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

  // 💡 [뒤로가기 대응 2단계] BFCache 강제 얼리기 캐시를 방지하기 위해 unload 감지 센서 작동
  useEffect(() => {
    const handleUnload = () => {};
    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, []);

  // 피드백 초기화
  const resetFeedback = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setFeedback('idle');
      setFeedbackMsg('');
      setFeedbackSub('');
      setDigits('');
    }, 3000);
  }, []);

  // 번호 입력
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

  // 제출
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
          // 💡 교직원 출퇴근 대응
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
          // 학생 출결
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

  const handleUndo = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // 오버레이 클릭 전파 방지
    if (!digits || digits.length !== 4 || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugStr, digits, action: 'undo' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFeedback('error'); // 빨간색 오버레이로 변경하여 취소 알림
        if (data.isTeacher) {
          setFeedbackMsg(`${data.teacherName} 선생님`);
          setFeedbackSub(`${data.type === '퇴근취소' ? '퇴근' : '출근'} 취소 완료`);
        } else {
          setFeedbackMsg(`${data.studentName} 학생`);
          setFeedbackSub(`${data.type === '하원취소' ? '하원' : '등원'} 취소 완료`);
        }
        await loadInfo();
        
        // 1.5초 뒤 완전히 리셋
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
          setFeedback('idle');
          setFeedbackMsg('');
          setFeedbackSub('');
          setDigits('');
        }, 1500);
      } else {
        alert(data.error || '취소 중 오류가 발생했습니다.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [digits, isSubmitting, slugStr, loadInfo]);

  // 키보드 지원
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      else if (e.key === 'Backspace') handleKey('backspace');
      else if (e.key === 'Enter') handleSubmit();
      else if (e.key === 'Escape') handleKey('clear');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey, handleSubmit]);

  const feedbackConfig: Record<string, { bg: string; icon: string }> = {
    'success-checkin':      { bg: '#1a8a4a', icon: '✅' },
    'success-late':         { bg: '#c97a00', icon: '⏰' },
    'success-checkout':     { bg: '#1d4ed8', icon: '🏠' },
    'success-teacher-in':   { bg: '#4f46e5', icon: '💼' }, // 💡 교직원 출근
    'success-teacher-out':  { bg: '#0891b2', icon: '🏃' }, // 💡 교직원 퇴근
    'already-done':         { bg: '#7c3aed', icon: 'ℹ️' },
    'error':                { bg: '#b91c1c', icon: '❌' },
  };
  const currentFeedback = feedbackConfig[feedback];

  return (
    <div style={styles.root}>
      {/* 왼쪽 사이드바 패널 */}
      <div style={styles.leftPanel}>
        {/* 상단 설정 버튼 */}
        <button
          onClick={() => window.location.href = `/${slugStr}/dashboard`}
          style={styles.settingBtn}
        >
          ⚙ 설정
        </button>

        {/* 학원 로고 및 이름 */}
        <div style={styles.brandContainer}>
          {/* 노란색 백팩/출결카드 형태 로고 아이콘 */}
          <div style={styles.brandLogo}>
            <div style={styles.logoCard}>
              <div style={styles.logoPhoto} />
              <div style={styles.logoLine1} />
              <div style={styles.logoLine2} />
            </div>
            {/* 체크 표시 */}
            <div style={styles.logoCheck}>✓</div>
          </div>
          <h2 style={styles.brandName}>{academyName || '호크마수학학원'}</h2>
        </div>

        {/* 날짜 및 디지털 시계 */}
        <div style={styles.dateTimeContainer}>
          <div style={styles.dateText}>{dateText}</div>
          <div style={styles.clockText}>{timeText}</div>
        </div>

        {/* 최근 출결 기록 타임라인 (사이드바에는 최신 10개만 보여줍니다) */}
        <div style={styles.recordList}>
          {recentRecords.slice(0, 10).map((r, i) => (
            <div key={i} style={styles.recordItem}>
              <div style={styles.recordTimeRow}>
                <span style={styles.clockIcon}>🕒</span>
                <span style={styles.recordTimeText}>{formatTime(r.time)}</span>
              </div>
              <div style={styles.recordNameBox}>
                {r.studentName}{r.type === '하원' ? ' (하원)' : ''}
              </div>
            </div>
          ))}
        </div>

        {/* 하단 제어 및 안내 영역 */}
        <div style={styles.footerContainer}>
          <div style={styles.footerButtons}>
            <button style={styles.footerBtn}>QR코드</button>
            <button
              onClick={() => setIsModalOpen(true)}
              style={styles.footerBtn}
            >
              = 기록전체보기
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            style={{ 
              ...styles.footerBtn, 
              width: '100%', 
              marginTop: '8px', 
              marginBottom: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '4px',
              padding: '10px 4px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              borderColor: 'rgba(255, 255, 255, 0.35)',
            }}
          >
            {isFullscreen ? '🗗 창모드 전환' : '🖥 전체화면 전환'}
          </button>
          <div style={styles.footerInfo}>
            <div>☉ 현재 설정된 회신번호 : {replyPhone}</div>
            <div>☉ 현재 설정된 꼬릿말 : {footerMemo}</div>
          </div>
        </div>
      </div>

      {/* 오른쪽 키패드 패널 */}
      <div style={styles.rightPanel}>
        {/* 피드백 알림 오버레이 */}
        {feedback !== 'idle' && currentFeedback && (
          <div style={{ ...styles.feedbackOverlay, backgroundColor: currentFeedback.bg }}>
            <div style={styles.feedbackIcon}>{currentFeedback.icon}</div>
            <div style={styles.feedbackMain}>{feedbackMsg}</div>
            <div style={styles.feedbackSub}>{feedbackSub}</div>
            
            {/* 💡 [즉시 취소 버튼] */}
            {['success-checkin', 'success-late', 'success-checkout', 'already-done'].includes(feedback) && (
              <button
                onClick={handleUndo}
                style={{
                  marginTop: '36px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '2px solid rgba(255, 255, 255, 0.6)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px 28px',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.3)'; }}
              >
                ❌ 잘못 입력하셨나요? 취소하기
              </button>
            )}
          </div>
        )}

        {/* 문구 */}
        <div style={styles.prompt}>출결번호를 입력하세요.</div>

        {/* 입력 임시 피드백 창 (원래 사진에는 없으나 편의를 위해 중앙 배치) */}
        <div style={styles.digitsViewer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} style={styles.digitChar}>
              {digits[i] ? digits[i] : '_'}
            </span>
          ))}
        </div>

        {/* 얇은 회색 선 격자로 분할된 3x4 바둑판 키패드 */}
        <div style={styles.keypadGrid}>
          {['1','2','3','4','5','6','7','8','9'].map((n) => (
            <button
              key={n}
              style={styles.gridNumBtn}
              onClick={() => handleKey(n)}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e5ebf5'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
            >
              {n}
            </button>
          ))}
          <button
            style={{ ...styles.gridBtn, color: '#0c73e8', fontWeight: 700, fontSize: '38px' }}
            onClick={() => handleKey('clear')}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e5ebf5'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
          >
            지움
          </button>
          <button
            style={styles.gridNumBtn}
            onClick={() => handleKey('0')}
            onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e5ebf5'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
          >
            0
          </button>
          <button
            style={{
              ...styles.gridBtn,
              color: digits.length === 4 ? '#0c73e8' : '#a3a3a3',
              fontWeight: 700,
              fontSize: '38px',
              cursor: digits.length === 4 ? 'pointer' : 'not-allowed'
            }}
            onClick={handleSubmit}
            disabled={digits.length !== 4 || isSubmitting}
            onMouseDown={(e) => { if (digits.length === 4) (e.currentTarget as HTMLElement).style.backgroundColor = '#e5ebf5'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; }}
          >
            {isSubmitting ? '...' : '입력'}
          </button>
        </div>
      </div>

      {/* 💡 [기록전체보기 모달 오버레이] */}
      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={() => { setIsModalOpen(false); setSearchTerm(''); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>오늘의 전체 출결 기록</h3>
              <button style={styles.modalCloseBtn} onClick={() => { setIsModalOpen(false); setSearchTerm(''); }}>
                ✕ 닫기
              </button>
            </div>
            
            {/* 💡 실시간 이름 검색창 영역 */}
            <div style={styles.modalSearchArea}>
              <input
                type="text"
                placeholder="🔍 검색할 학생 이름을 입력하세요..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.modalSearchInput}
              />
            </div>
            
            <div style={styles.modalBody}>
              {recentRecords.length === 0 ? (
                <div style={styles.modalEmpty}>오늘 기록된 출결 내역이 없습니다.</div>
              ) : (() => {
                const filteredRecords = recentRecords.filter(r => 
                  r.studentName.toLowerCase().includes(searchTerm.toLowerCase().trim())
                );
                
                if (filteredRecords.length === 0) {
                  return <div style={styles.modalEmpty}>&apos;{searchTerm}&apos; 학생의 검색 결과가 없습니다.</div>;
                }

                return (
                  <table style={styles.modalTable}>
                    <thead>
                      <tr>
                        <th style={styles.modalTh}>시간</th>
                        <th style={styles.modalTh}>이름</th>
                        <th style={styles.modalTh}>구분</th>
                        <th style={styles.modalTh}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r, i) => {
                        const isCheckout = r.type === '하원';
                        const isLate = r.status === '지각';
                        return (
                          <tr key={i} style={styles.modalTr}>
                            <td style={styles.modalTd}>{formatTime(r.time)}</td>
                            <td style={{ ...styles.modalTd, fontWeight: 700 }}>{r.studentName}</td>
                            <td style={styles.modalTd}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: isCheckout ? 'rgba(29,78,216,0.1)' : 'rgba(26,138,74,0.1)',
                                color: isCheckout ? '#1d4ed8' : '#1a8a4a',
                              }}>
                                {r.type}
                              </span>
                            </td>
                            <td style={styles.modalTd}>
                              {isCheckout ? (
                                <span style={{ color: '#6b7280' }}>-</span>
                              ) : (
                                <span style={{
                                  fontWeight: 600,
                                  color: isLate ? '#c97a00' : '#1a8a4a'
                                }}>
                                  {r.status || '출석'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100dvh',
    width: '100dvw',
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    overflow: 'hidden',
    backgroundColor: '#F2F5FA',
    userSelect: 'none',
  },
  leftPanel: {
    width: 320,
    minWidth: 320,
    backgroundColor: '#0c73e8', // 밝은 블루 단색
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 20px',
    color: '#ffffff',
    flexShrink: 0,
    position: 'relative',
  },
  settingBtn: {
    position: 'absolute',
    left: 20,
    top: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  },
  brandContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 16,
  },
  brandLogo: {
    width: 64,
    height: 64,
    backgroundColor: '#ffd13b', // 노란색 카드 배경
    borderRadius: '16px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    marginBottom: 12,
  },
  logoCard: {
    width: 32,
    height: 40,
    border: '2px solid #0c73e8',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    padding: 3,
    gap: 3,
  },
  logoPhoto: {
    width: 12,
    height: 12,
    backgroundColor: '#0c73e8',
    borderRadius: '2px',
  },
  logoLine1: {
    width: '100%',
    height: 3,
    backgroundColor: '#0c73e8',
  },
  logoLine2: {
    width: '70%',
    height: 3,
    backgroundColor: '#0c73e8',
  },
  logoCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: '#0c73e8',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffd13b',
  },
  brandName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    margin: 0,
  },
  dateTimeContainer: {
    textAlign: 'center',
    marginBottom: 28,
  },
  dateText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
    fontWeight: 500,
  },
  clockText: {
    fontSize: '46px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#ffffff',
    fontVariantNumeric: 'tabular-nums',
  },
  recordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    flex: 1,
    overflowY: 'auto',
    paddingRight: 4,
  },
  recordItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  recordTimeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  clockIcon: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  recordTimeText: {
    fontSize: '13px',
    color: '#ffffff',
    fontWeight: 500,
  },
  recordNameBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // 반투명 둥근 박스
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 800,
    textAlign: 'center',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  footerContainer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTop: '1px solid rgba(255, 255, 255, 0.15)',
  },
  footerButtons: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  footerBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    color: '#ffffff',
    padding: '8px 4px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '4px',
    cursor: 'pointer',
  },
  footerInfo: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    textAlign: 'left',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    backgroundColor: '#ffffff',
    padding: '30px 0 0 0', // 좌우하단 패딩 제거하여 꽉 채움
  },
  feedbackOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  feedbackIcon: {
    fontSize: '80px',
    marginBottom: 24,
  },
  feedbackMain: {
    fontSize: '40px',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  feedbackSub: {
    fontSize: '22px',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  prompt: {
    fontSize: '44px',
    fontWeight: 800,
    color: '#0c73e8', // 짙은 파란색
    marginBottom: 10,
    textAlign: 'center',
  },
  digitsViewer: {
    display: 'flex',
    gap: 20,
    marginBottom: 20,
    height: '60px',
    alignItems: 'center',
  },
  digitChar: {
    fontSize: '60px',
    fontWeight: 900,
    color: '#0c73e8',
    width: '48px',
    textAlign: 'center',
  },
  keypadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(4, 1fr)', // 4행 세로 꽉 채우기
    width: '100%',
    flex: 1, // 남은 세로 높이 전부 할당
    backgroundColor: '#ffffff',
    borderTop: '1.5px solid #d5dbe5',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: 'none',
  },
  gridBtn: {
    height: '100%',
    backgroundColor: '#ffffff',
    border: '1.5px solid #d5dbe5',
    borderTop: 'none',
    borderLeft: 'none',
    fontSize: '46px', // 한글 폰트 크기 확대
    fontWeight: 700, 
    color: '#0c73e8',
    cursor: 'pointer',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.1s',
  },
  gridNumBtn: {
    height: '100%',
    backgroundColor: '#ffffff',
    border: '1.5px solid #d5dbe5',
    borderTop: 'none',
    borderLeft: 'none',
    fontSize: '68px', // 숫자 폰트 크기 확대
    fontWeight: 900, 
    color: '#0c73e8',
    cursor: 'pointer',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.1s',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'between',
    backgroundColor: '#0c73e8',
    color: '#ffffff',
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    flex: 1,
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  modalTh: {
    padding: '12px 16px',
    borderBottom: '2px solid #e5e7eb',
    color: '#374151',
    fontWeight: 700,
    fontSize: '14px',
  },
  modalTr: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.1s',
  },
  modalTd: {
    padding: '14px 16px',
    color: '#4b5563',
    fontSize: '15px',
  },
  modalEmpty: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#9ca3af',
    fontSize: '15px',
  },
  modalSearchArea: {
    padding: '16px 24px 8px 24px',
    backgroundColor: '#ffffff',
  },
  modalSearchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid #d5dbe5',
    fontSize: '16px',
    fontWeight: 500,
    color: '#1e293b',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
};
