'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper } from '@/types/exam';

interface ExamPaperListProps {
  academyId: string;
  onSelect: (exam: ExamPaper) => void;
  onEdit: (exam: ExamPaper) => void;
  onEditAnswerKey: (exam: ExamPaper) => void;
  onDelete: (examId: string) => void;
  onCreateNew: () => void;
}

const REGION_OPTIONS = ['전체', '서울/강남', '서울/서초', '서울/송파', '서울/목동', '서울/중계', '대구/수성', '부산/해운대', '부천', '기타'];
const GRADE_OPTIONS = ['전체', '중1', '중2', '중3', '고1', '고2', '고3'];
const SUBJECT_OPTIONS = ['전체', '수학', '영어', '국어', '과학', '사회'];
const SEMESTER_OPTIONS = ['전체', '1학기 중간', '1학기 기말', '2학기 중간', '2학기 기말'];

export default function ExamPaperList({
  academyId,
  onSelect,
  onEdit,
  onEditAnswerKey,
  onDelete,
  onCreateNew,
}: ExamPaperListProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = ['전체', ...Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())];

  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ExamPaper | null>(null); // 💡 삭제 분기 제어용 상태 추가
  const [academyLocation, setAcademyLocation] = useState<string>(''); // 💡 학원 위치 정보 보관

  // 💡 학원 위치 정보 로드
  useEffect(() => {
    const fetchAcademyLocation = async () => {
      if (!academyId) return;
      try {
        const { data } = await supabase
          .from('ams_academies')
          .select('operation_settings')
          .eq('id', academyId)
          .single();
        if (data?.operation_settings?.location) {
          setAcademyLocation(data.operation_settings.location);
        }
      } catch (err) {
        console.error('Fetch academy location error:', err);
      }
    };
    fetchAcademyLocation();
  }, [academyId]);

  // 💡 학원 위치 기반 지역 필터 순서 동적 가공
  const dynamicRegionOptions = useMemo(() => {
    const baseOptions = ['전체', '서울/강남', '서울/서초', '서울/송파', '서울/목동', '서울/중계', '대구/수성', '부산/해운대', '부천', '기타'];
    if (!academyLocation) return baseOptions;
    
    const cleanLocation = academyLocation.trim();
    if (!cleanLocation) return baseOptions;

    const filtered = baseOptions.filter((opt) => opt !== '전체' && opt !== cleanLocation);
    return ['전체', cleanLocation, ...filtered];
  }, [academyLocation]);

  // 기본 검색/필터 상태
  const [keyword, setKeyword] = useState('');
  const [region, setRegion] = useState('전체');
  const [grade, setGrade] = useState('전체');
  const [subject, setSubject] = useState('전체');
  const [year, setYear] = useState('전체');
  const [semester, setSemester] = useState('전체');

  // 첨부파일 정교화 필터 상태 ('all' | 'both' | 'pdf_only' | 'hwp_only' | 'none')
  const [attachmentFilter, setAttachmentFilter] = useState<'all' | 'both' | 'pdf_only' | 'hwp_only' | 'none'>('all');
  const [errorFilter, setErrorFilter] = useState<'all' | 'has_error' | 'no_error'>('all');

  // 파일 확장자 판별 헬퍼
  const hasPdf = (links: string[]) => links.some((l) => l.toLowerCase().endsWith('.pdf'));
  const hasHwp = (links: string[]) => links.some((l) => {
    const low = l.toLowerCase();
    return low.endsWith('.hwp') || low.endsWith('.hwpx');
  });

  // 필터 초기화
  const handleClearFilters = () => {
    setKeyword('');
    setRegion('전체');
    setGrade('전체');
    setSubject('전체');
    setYear('전체');
    setSemester('전체');
    setAttachmentFilter('all');
    setErrorFilter('all');
  };

  // 데이터 가져오기
  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ams_exam_papers')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });

      if (keyword.trim()) {
        query = query.or(`title.ilike.%${keyword}%,school.ilike.%${keyword}%,scope.ilike.%${keyword}%,exam_code.ilike.%${keyword}%`);
      }
      if (region !== '전체') query = query.eq('region', region);
      if (grade !== '전체') query = query.eq('grade', grade);
      if (subject !== '전체') query = query.eq('subject', subject);
      if (year !== '전체') query = query.eq('year', parseInt(year));
      if (semester !== '전체') query = query.eq('semester', semester);

      const { data, error } = await query;
      if (error) throw error;
      setExams(data || []);
    } catch (err: any) {
      console.error('Error fetching exams:', err.message);
    } finally {
      setLoading(false);
    }
  }, [academyId, keyword, region, grade, subject, year, semester]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // 원클릭 즉시 짝등록 핸들러
  const handleInstantUpload = async (examId: string, currentLinks: string[], type: 'pdf' | 'hwp') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'pdf' ? '.pdf' : '.hwp,.hwpx';

    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      try {
        // 한글 및 특수문자를 제거하여 순수 ASCII 파일명 생성 (스토리지 에러 방지)
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `${academyId}/${Date.now()}_${cleanFileName}`;

        // 1. Storage 업로드
        const { error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. URL 가져오기
        const { data } = supabase.storage
          .from('exam-papers')
          .getPublicUrl(filePath);

        if (!data?.publicUrl) throw new Error('Public URL 생성 실패');

        // 3. DB 업데이트 (원본 한글 파일명을 쿼리 스트링으로 결합)
        const fileUrlWithQuery = data.publicUrl + '?filename=' + encodeURIComponent(file.name.normalize('NFC'));
        const updatedLinks = [...(currentLinks || []), fileUrlWithQuery];
        const { error: updateError } = await supabase
          .from('ams_exam_papers')
          .update({ file_links: updatedLinks, updated_at: new Date().toISOString() })
          .eq('id', examId);

        if (updateError) throw updateError;

        // 4. 리로드 및 알림
        await fetchExams();
      } catch (err: any) {
        alert(`즉시 짝등록 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    input.click();
  };

  // 오류 여부 즉시 토글 핸들러
  const handleToggleError = async (examId: string, currentVal: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ams_exam_papers')
        .update({ has_error: !currentVal, updated_at: new Date().toISOString() })
        .eq('id', examId);
      if (error) throw error;
      await fetchExams();
    } catch (err: any) {
      alert(`오류 상태 변경 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 💡 개별 파일 등록 해제 및 스토리지 삭제 핸들러
  const handleDeleteFile = async (examId: string, currentLinks: string[], fileUrl: string) => {
    if (!confirm('이 첨부파일을 영구 삭제하시겠습니까?\n스토리지에서도 즉시 제거됩니다.')) return;

    setLoading(true);
    try {
      // 1. Storage에서 실제 파일 삭제 처리
      const pathPart = fileUrl.split('/exam-papers/')[1]?.split('?')[0];
      if (pathPart) {
        const decodedPath = decodeURIComponent(pathPart);
        const { error: storageError } = await supabase.storage
          .from('exam-papers')
          .remove([decodedPath]);

        if (storageError) {
          console.warn('Storage file removal skipped/failed:', storageError.message);
        }
      }

      // 2. DB의 file_links 배열에서 해당 링크 필터링 제거 후 업데이트
      const updatedLinks = (currentLinks || []).filter((l) => l !== fileUrl);
      const { error: dbError } = await supabase
        .from('ams_exam_papers')
        .update({ file_links: updatedLinks, updated_at: new Date().toISOString() })
        .eq('id', examId);

      if (dbError) throw dbError;

      // 3. 리스트 새로고침
      await fetchExams();
    } catch (err: any) {
      alert(`파일 삭제 중 오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 클라이언트 사이드 파일 필터링 가공
  const filteredExams = exams.filter((exam) => {
    const links = exam.file_links || [];
    const pdfExist = hasPdf(links);
    const hwpExist = hasHwp(links);

    if (attachmentFilter === 'both') if (!pdfExist || !hwpExist) return false;
    if (attachmentFilter === 'pdf_only') if (!pdfExist || hwpExist) return false;
    if (attachmentFilter === 'hwp_only') if (pdfExist || !hwpExist) return false;
    if (attachmentFilter === 'none') if (pdfExist || hwpExist) return false;

    if (errorFilter === 'has_error') return exam.has_error === true;
    if (errorFilter === 'no_error') return exam.has_error !== true;

    return true;
  });

  return (
    <div style={styles.container}>
      {/* 상단 검색 및 추가 */}
      <div style={styles.topRow}>
        <div style={styles.searchBox}>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="시험지 제목, 학교, 시험 범위, 시험지 코드로 검색"
            style={styles.searchInput}
          />
        </div>
        <button onClick={onCreateNew} style={styles.createBtn}>
          ➕ 새 시험지 등록
        </button>
      </div>

      {/* 필터 그룹 */}
      <div style={styles.filterGroup}>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>지역</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={styles.filterSelect}>
            {dynamicRegionOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>학년</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={styles.filterSelect}>
            {GRADE_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>과목</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.filterSelect}>
            {SUBJECT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>년도</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} style={styles.filterSelect}>
            {yearOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>학기</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} style={styles.filterSelect}>
            {SEMESTER_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>

        {/* 💡 첨부파일 상세 상태 필터 추가 */}
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>첨부파일 상태</label>
          <select
            value={attachmentFilter}
            onChange={(e) => setAttachmentFilter(e.target.value as any)}
            style={{ ...styles.filterSelect, minWidth: 140, borderColor: attachmentFilter !== 'all' ? '#4361ee' : '#334155' }}
          >
            <option value="all">전체 첨부 상태</option>
            <option value="both">짝 완료 (PDF+한글 둘 다)</option>
            <option value="pdf_only">PDF만 있음 (한글 누락)</option>
            <option value="hwp_only">한글만 있음 (PDF 누락)</option>
            <option value="none">첨부파일 없음</option>
          </select>
        </div>

        {/* 💡 오류 상태 필터 추가 */}
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>오류 여부</label>
          <select
            value={errorFilter}
            onChange={(e) => setErrorFilter(e.target.value as any)}
            style={{ ...styles.filterSelect, minWidth: 120, borderColor: errorFilter !== 'all' ? '#ef4444' : '#334155' }}
          >
            <option value="all">전체 오류 상태</option>
            <option value="has_error">🔴 오류 있음</option>
            <option value="no_error">🟢 정상</option>
          </select>
        </div>

        <button onClick={handleClearFilters} style={styles.clearBtn}>
          🔄 필터 초기화
        </button>
      </div>

      {/* 시험지 개수 */}
      <div style={styles.countText}>총 {filteredExams.length}건의 시험지</div>

      {/* 결과 리스트 */}
      {loading ? (
        <div style={styles.statusBox}>로딩 및 처리 중...</div>
      ) : filteredExams.length === 0 ? (
        <div style={styles.statusBox}>조건에 맞는 시험지가 존재하지 않습니다.</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>코드</th>
                <th style={styles.th}>연도/학기</th>
                <th style={styles.th}>구분 (지역/학교/학년)</th>
                <th style={styles.th}>시험지 제목</th>
                <th style={styles.th}>문항 수</th>
                <th style={styles.th}>파일 짝 (원클릭 짝등록)</th>
                <th style={styles.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredExams.map((exam) => {
                const links = exam.file_links || [];
                const pdf = hasPdf(links);
                const hwp = hasHwp(links);
                const pdfUrl = links.find((l) => l.toLowerCase().endsWith('.pdf'));
                const hwpUrl = links.find((l) => {
                  const low = l.toLowerCase();
                  return low.endsWith('.hwp') || low.endsWith('.hwpx');
                });

                return (
                  <tr key={exam.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#38bdf8' }} onClick={() => onSelect(exam)}>
                      {exam.exam_code || '-'}
                    </td>
                    <td style={styles.td} onClick={() => onSelect(exam)}>
                      {exam.year}년 {exam.semester}
                    </td>
                    <td style={styles.td} onClick={() => onSelect(exam)}>
                      <span style={styles.badge}>{exam.subject}</span>
                      <span style={{ marginLeft: 6 }}>
                        {exam.region} | {exam.school || '미지정'} ({exam.grade})
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600, color: '#e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span onClick={() => onSelect(exam)} style={{ cursor: 'pointer' }}>{exam.title}</span>
                        {exam.has_error ? (
                          <span
                            onClick={() => handleToggleError(exam.id, exam.has_error)}
                            style={styles.errorBadgeActive}
                            title="클릭하여 정상 상태로 처리 (오류 해결 완료)"
                          >
                            🔴 오류
                          </span>
                        ) : (
                          <span
                            onClick={() => handleToggleError(exam.id, exam.has_error)}
                            style={styles.errorBadgeInactive}
                            title="클릭하여 시험지 오류 마킹"
                          >
                            🔘
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={styles.td} onClick={() => onSelect(exam)}>
                      {exam.question_count}문항
                    </td>
                    
                    {/* 💡 파일 짝 표시 및 원클릭 즉시 짝등록 구역 (뱃지 ✕ 삭제 기호 완전 롤백) */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* PDF 뱃지 */}
                        {pdf ? (
                          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={styles.badgeBtnActive}>
                            PDF
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstantUpload(exam.id, links, 'pdf')}
                            style={styles.badgeBtnInactive}
                            title="클릭하여 즉시 PDF 등록"
                          >
                            + PDF
                          </button>
                        )}

                        {/* HWP 뱃지 */}
                        {hwp ? (
                          <a href={hwpUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.badgeBtnActive, background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                            한글
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstantUpload(exam.id, links, 'hwp')}
                            style={styles.badgeBtnInactive}
                            title="클릭하여 즉시 한글(HWP) 등록"
                          >
                            + 한글
                          </button>
                        )}
                      </div>
                    </td>

                     <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button onClick={() => onEdit(exam)} style={styles.editBtn}>✏️ 정보</button>
                        <button onClick={() => onEditAnswerKey(exam)} style={styles.answerKeyBtn}>🔑 정답</button>
                        <button onClick={() => setDeleteTarget(exam)} style={styles.deleteBtn}>🗑️ 삭제</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 💡 삭제 대상 분기 처리 모달 */}
      {deleteTarget && (
        <div style={modalStyles.overlay} onClick={() => setDeleteTarget(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalStyles.title}>🗑️ 삭제 대상 선택</h3>
            <p style={modalStyles.subtitle}>
              <strong style={{ color: '#60a5fa' }}>{deleteTarget.title}</strong>
              <br />
              삭제할 대상을 한 개씩 선택하거나 전체 삭제할 수 있습니다.
            </p>
            
            <div style={modalStyles.btnGroup}>
              {/* PDF 삭제 옵션 */}
              {hasPdf(deleteTarget.file_links || []) ? (
                <button
                  type="button"
                  style={modalStyles.actionBtn}
                  onClick={async () => {
                    const pdfUrl = (deleteTarget.file_links || []).find((l) => l.toLowerCase().endsWith('.pdf'));
                    if (pdfUrl) {
                      await handleDeleteFile(deleteTarget.id, deleteTarget.file_links, pdfUrl);
                    }
                    setDeleteTarget(null);
                  }}
                >
                  📄 PDF 파일만 단독 삭제
                </button>
              ) : (
                <button type="button" disabled style={modalStyles.disabledBtn}>
                  📄 등록된 PDF 파일 없음
                </button>
              )}

              {/* 한글 삭제 옵션 */}
              {hasHwp(deleteTarget.file_links || []) ? (
                <button
                  type="button"
                  style={modalStyles.actionBtn}
                  onClick={async () => {
                    const hwpUrl = (deleteTarget.file_links || []).find((l) => {
                      const low = l.toLowerCase();
                      return low.endsWith('.hwp') || low.endsWith('.hwpx');
                    });
                    if (hwpUrl) {
                      await handleDeleteFile(deleteTarget.id, deleteTarget.file_links, hwpUrl);
                    }
                    setDeleteTarget(null);
                  }}
                >
                  📝 한글 파일만 단독 삭제
                </button>
              ) : (
                <button type="button" disabled style={modalStyles.disabledBtn}>
                  📝 등록된 한글 파일 없음
                </button>
              )}

              {/* 전체 삭제 옵션 */}
              <button
                type="button"
                style={modalStyles.dangerBtn}
                onClick={async () => {
                  setDeleteTarget(null);
                  // 부모의 onDelete 트리거 실행 (시험지 전체 데이터 삭제)
                  onDelete(deleteTarget.id);
                }}
              >
                🔥 시험지 전체 삭제 (모든 정보 영구삭제)
              </button>

              <button
                type="button"
                style={modalStyles.cancelBtn}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 💡 삭제 선택 모달 전용 프리미엄 스타일 클래스
const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    background: '#18182b',
    border: '1.5px solid #2e2e4a',
    borderRadius: 20,
    padding: '24px 20px',
    width: '90%',
    maxWidth: 380,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    fontFamily: "'Pretendard', sans-serif",
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 17,
    fontWeight: 800,
    color: '#f8fafc',
  },
  subtitle: {
    margin: '0 0 20px 0',
    fontSize: 12.5,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    background: '#242442',
    color: '#38bdf8',
    border: '1px solid #334155',
    padding: '11px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12.5,
    transition: 'all 0.15s',
  },
  disabledBtn: {
    background: 'rgba(255, 255, 255, 0.02)',
    color: '#475569',
    border: '1px dashed #27273f',
    padding: '11px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: 'not-allowed',
  },
  dangerBtn: {
    background: '#e11d48',
    color: '#fff',
    border: 'none',
    padding: '11px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 12.5,
    marginTop: 8,
    transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    padding: '10px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 12.5,
    marginTop: 4,
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: { color: '#e2e8f0', fontFamily: "'Pretendard', sans-serif" },
  topRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  searchBox: { flex: 1, minWidth: 280 },
  searchInput: { width: '100%', height: 42, borderRadius: 8, border: '1.5px solid #334155', background: '#1f1f3a', color: '#e2e8f0', padding: '0 14px', fontSize: 14, outline: 'none' },
  createBtn: { background: '#4361ee', color: '#fff', border: 'none', padding: '0 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, height: 42 },
  filterGroup: { display: 'flex', gap: 12, background: '#16162a', padding: 14, borderRadius: 12, border: '1px solid #2e2e4a', marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, color: '#888', fontWeight: 600 },
  filterSelect: { height: 36, borderRadius: 6, border: '1px solid #334155', background: '#20203a', color: '#ccc', padding: '0 8px', fontSize: 13, minWidth: 90, outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s' },
  clearBtn: { height: 36, background: 'transparent', border: '1px solid #555', color: '#aaa', padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  countText: { fontSize: 13, color: '#888', marginBottom: 10, textAlign: 'right' },
  statusBox: { background: '#16162a', padding: 40, borderRadius: 12, textAlign: 'center', border: '1px solid #2e2e4a', color: '#888', fontSize: 14 },
  tableContainer: { background: '#16162a', borderRadius: 12, border: '1px solid #2e2e4a', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 },
  thRow: { background: '#20203a', borderBottom: '1.5px solid #2e2e4a' },
  th: { padding: '14px 16px', fontWeight: 600, color: '#888' },
  tr: { borderBottom: '1px solid #2e2e4a', cursor: 'pointer', transition: 'background 0.15s' },
  td: { padding: '14px 16px', color: '#ccc', verticalAlign: 'middle' },
  badge: { background: 'rgba(67,97,238,0.15)', color: '#4361ee', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  actionGroup: { display: 'flex', gap: 8 },
  editBtn: { background: '#2a2a4a', color: '#4361ee', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  answerKeyBtn: { background: '#2a2a4a', color: '#10b981', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  deleteBtn: { background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: 'none', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  
  // 뱃지 버튼 스타일
  badgeBtnActive: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(67,97,238,0.15)', color: '#4361ee', border: '1px solid rgba(67,97,238,0.3)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' },
  badgeBtnInactive: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#64748b', border: '1px dashed #475569', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  errorBadgeActive: { display: 'inline-flex', alignItems: 'center', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' },
  errorBadgeInactive: { display: 'inline-flex', alignItems: 'center', opacity: 0.2, cursor: 'pointer', fontSize: 10 },
};
