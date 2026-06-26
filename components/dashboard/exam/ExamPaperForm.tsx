'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaperFormData } from '@/types/exam';
import { styles } from './examFormStyles';

interface ExamPaperFormProps {
  academyId: string;
  onSubmit: (data: ExamPaperFormData) => void;
  onCancel: () => void;
  initialData?: Partial<ExamPaperFormData>;
  isEditing?: boolean;
}

const REGION_OPTIONS = [
  '서울/강남',
  '서울/서초',
  '서울/송파',
  '서울/목동',
  '서울/중계',
  '대구/수성',
  '부산/해운대',
  '부천',
  '기타',
];
const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];
const SUBJECT_OPTIONS = ['수학', '영어', '국어', '과학', '사회'];
const SEMESTER_OPTIONS = ['1학기 중간', '1학기 기말', '2학기 중간', '2학기 기말'];

export default function ExamPaperForm({
  academyId,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}: ExamPaperFormProps) {
  const currentYear = new Date().getFullYear();

  const [examCode, setExamCode] = useState(initialData?.exam_code || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [selectedRegion, setSelectedRegion] = useState(() => {
    const reg = initialData?.region || '서울/강남';
    return REGION_OPTIONS.includes(reg) ? reg : '기타';
  });
  const [customRegion, setCustomRegion] = useState(() => {
    const reg = initialData?.region || '';
    return REGION_OPTIONS.includes(reg) ? '' : reg;
  });
  const [school, setSchool] = useState(initialData?.school || '');
  const [grade, setGrade] = useState(initialData?.grade || '중1');
  const [subject, setSubject] = useState(initialData?.subject || '수학');
  const [year, setYear] = useState(initialData?.year || currentYear);
  const [semester, setSemester] = useState(initialData?.semester || '1학기 중간');
  const [scope, setScope] = useState(initialData?.scope || '');
  const [questionCount, setQuestionCount] = useState(initialData?.question_count || 25);
  
  // Storage 연동 파일 업로드 관리
  const [fileLinks, setFileLinks] = useState<string[]>(initialData?.file_links || []);
  const [uploading, setUploading] = useState(false);
  const [hasError, setHasError] = useState(initialData?.has_error || false);
  const [errorNotes, setErrorNotes] = useState(initialData?.error_notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Supabase Storage 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newLinks = [...fileLinks];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 한글 및 공백 파일명 안전 정제 (순수 ASCII화로 스토리지 에러 원천 차단)
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `${academyId}/${Date.now()}_${cleanFileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('exam-papers')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          // 한글 원본 파일명을 쿼리 파라미터로 바인딩하여 보존
          const fileUrlWithQuery = data.publicUrl + '?filename=' + encodeURIComponent(file.name.normalize('NFC'));
          newLinks.push(fileUrlWithQuery);
        }
      } catch (err: any) {
        console.error('File upload error:', err);
        alert(`업로드 실패 (${file.name}): ${err.message}`);
      }
    }

    setFileLinks(newLinks);
    setUploading(false);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFileLinks(prev => prev.filter((_, i) => i !== index));
  };

  const getOriginalFilename = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const filenameParam = parsedUrl.searchParams.get('filename');
      if (filenameParam) {
        return decodeURIComponent(filenameParam);
      }
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1].split('?')[0];
      return lastPart.replace(/^\d+_/, '');
    } catch {
      try {
        const decoded = decodeURIComponent(url);
        const parts = decoded.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.replace(/^\d+_/, '');
      } catch {
        return '첨부 파일';
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = '시험지 제목을 입력해주세요.';
    if (selectedRegion === '기타' && !customRegion.trim()) {
      newErrors.region = '기타 지역명을 직접 입력해주세요.';
    }
    if (questionCount < 1 || questionCount > 30) {
      newErrors.questionCount = '문항 수는 1문항에서 30문항 사이로 설정해야 합니다.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const region = selectedRegion === '기타' ? customRegion.trim() : selectedRegion;
    const data: ExamPaperFormData = {
      exam_code: examCode.trim(),
      title: title.trim(),
      region,
      school: school.trim(),
      grade,
      subject,
      year,
      semester,
      scope: scope.trim(),
      question_count: questionCount,
      answer_key: initialData?.answer_key || {},
      question_types: initialData?.question_types || {},
      essay_questions: initialData?.essay_questions || [],
      file_links: fileLinks,
      tags: initialData?.tags || [],
      has_error: hasError,
      error_notes: errorNotes,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.grid}>
        {/* 시험지 코드 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>시험지 코드 (선택)</label>
          <input
            type="text"
            value={examCode}
            onChange={(e) => setExamCode(e.target.value)}
            placeholder="예: M-2401"
            style={styles.input}
          />
        </div>

        {/* 시험지 제목 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>시험지 제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2024년 대치중 2학년 1학기 중간고사 수학"
            style={{
              ...styles.input,
              borderColor: errors.title ? '#e74c3c' : '#334155',
            }}
          />
          {errors.title && <span style={styles.errorText}>{errors.title}</span>}
        </div>

        {/* 지역 설정 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>지역 *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={styles.select}
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {selectedRegion === '기타' && (
              <input
                type="text"
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder="지역명 입력"
                style={{
                  ...styles.input,
                  flex: 1,
                  borderColor: errors.region ? '#e74c3c' : '#334155',
                }}
              />
            )}
          </div>
          {errors.region && <span style={styles.errorText}>{errors.region}</span>}
        </div>

        {/* 학교명 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>학교명 (선택)</label>
          <input
            type="text"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="예: 대치중학교"
            style={styles.input}
          />
        </div>

        {/* 학년 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>학년</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={styles.select}>
            {GRADE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 과목 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>과목</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.select}>
            {SUBJECT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 시험 년도 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>시험 년도</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
            style={styles.input}
          />
        </div>

        {/* 학기 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>학기</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} style={styles.select}>
            {SEMESTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 시험 범위 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>시험 범위</label>
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="예: 다항식 ~ 이차방정식"
            style={styles.input}
          />
        </div>

        {/* 문항 수 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>문항 수 * (1-30)</label>
          <input
            type="number"
            min="1"
            max="30"
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value) || 0)}
            style={{
              ...styles.input,
              borderColor: errors.questionCount ? '#e74c3c' : '#334155',
            }}
          />
          {errors.questionCount && <span style={styles.errorText}>{errors.questionCount}</span>}
        </div>

        {/* 파일 업로드 구역 */}
        <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
          <label style={styles.label}>원본 시험지 파일 업로드 (PDF / HWP / 이미지 등)</label>
          <div style={styles.uploadBox}>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="file-upload-input"
              disabled={uploading}
            />
            <label htmlFor="file-upload-input" style={styles.uploadLabel}>
              {uploading ? '⏳ 파일 업로드 중...' : '➕ 클릭해서 파일 선택 (PDF / HWP / HWPT 복수 가능)'}
            </label>
          </div>
          
          {/* 업로드된 파일 리스트 */}
          {fileLinks.length > 0 && (
            <div style={styles.fileList}>
              {fileLinks.map((link, idx) => (
                <div key={idx} style={styles.fileItem}>
                  <span style={styles.fileName}>📎 {getOriginalFilename(link)}</span>
                  <button type="button" onClick={() => handleRemoveFile(idx)} style={styles.fileRemoveBtn}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오류 여부 설정 */}
        <div style={{ ...styles.formGroup, gridColumn: 'span 2', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="has-error-checkbox"
              checked={hasError}
              onChange={(e) => {
                setHasError(e.target.checked);
                if (!e.target.checked) setErrorNotes(''); // 체크 해제 시 내용 비우기
              }}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="has-error-checkbox" style={{ ...styles.label, color: hasError ? '#ef4444' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              ⚠️ 이 시험지에 수정되지 않은 오류(오타 / 정답 오류 등)가 있습니다.
            </label>
          </div>

          {hasError && (
            <div style={{ ...styles.formGroup, marginTop: 4 }}>
              <label style={{ ...styles.label, color: '#ef4444', fontSize: 12 }}>세부 오류 내용 (선생님들에게 공지됨)</label>
              <textarea
                value={errorNotes}
                onChange={(e) => setErrorNotes(e.target.value)}
                placeholder="예: 3번 문항 정답 표기 오류 (실제 답은 4번이나 2번으로 잘못 채점됨)"
                style={{
                  ...styles.input,
                  height: 70,
                  padding: '8px 12px',
                  resize: 'none',
                  fontSize: 13,
                  marginTop: 4,
                  lineHeight: '1.4',
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={styles.actions}>
        <button type="submit" style={styles.submitBtn}>
          {isEditing ? '✏️ 시험지 정보 수정' : '➡️ 정답 입력 단계로'}
        </button>
        <button type="button" onClick={onCancel} style={styles.cancelBtn}>
          취소
        </button>
      </div>
    </form>
  );
}
