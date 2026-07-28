import { useCallback } from 'react';
import * as XLSX from 'xlsx';

export interface UseTodaySheetImportParams {
  students: any[];
  onBatchSave: (updates: any[]) => Promise<void>;
}

/**
 * 📝 [리팩토링] useTodaySheetImport: 아카2000 엑셀 일지 데이터 파일을 판독하여 일괄 복원/가져오기 전용 공용 훅
 * 문자열 파싱 알고리즘(괄호 점수/개수 분류 규칙 등)을 단 한 줄의 유실 없이 그대로 보존합니다.
 */
export function useTodaySheetImport({
  students,
  onBatchSave,
}: UseTodaySheetImportParams) {

  const handleImportExcel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        if (rows.length < 2) {
          alert('엑셀 파일에 데이터가 부족합니다.');
          return;
        }
        
        const headers: any = rows[0];
        const classworkIdx = headers.indexOf('진도');
        const testIdx = headers.indexOf('테스트');
        const homeworkIdx = headers.indexOf('과제');
        const notesIdx = headers.indexOf('기타');
        const classNameIdx = headers.indexOf('반명');
        
        if (classNameIdx === -1) {
          alert("올바른 아카 2000 엑셀 포맷이 아닙니다. '반명' 열이 존재해야 합니다.");
          return;
        }
        
        const sessionUpdates: any[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row: any = rows[i];
          if (!row || row.length === 0) continue;
          
          const classNameVal = String(row[classNameIdx] || '').trim();
          if (!classNameVal) continue;
          
          const studentName = classNameVal.split('-')[0].trim();
          if (!studentName) continue;
          
          const matchedStudent = students.find((s: any) => s.name.trim() === studentName);
          if (!matchedStudent) {
            console.log(`[Import Excel] 매칭되는 학생을 찾을 수 없음: ${studentName}`);
            continue;
          }
          
          const classworkText = classworkIdx !== -1 ? String(row[classworkIdx] || '').trim() : '';
          const homeworkText = homeworkIdx !== -1 ? String(row[homeworkIdx] || '').trim() : '';
          const specialNotes = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';
          const rawTestVal = testIdx !== -1 ? String(row[testIdx] || '').trim() : '';
          
          let testId = '';
          let testScore = '';
          let testScoreType = 'score';
          let testTotalCount = '';
          
          if (rawTestVal) {
            const parenIdx = rawTestVal.indexOf('(');
            if (parenIdx !== -1) {
              testId = rawTestVal.substring(0, parenIdx).trim();
              const scorePart = rawTestVal.substring(parenIdx + 1, rawTestVal.length - 1).trim();
              
              if (scorePart.includes('/') && scorePart.includes('개')) {
                testScoreType = 'count';
                const parts = scorePart.replace(/개/g, '').split('/');
                testScore = parts[0]?.trim() || '';
                testTotalCount = parts[1]?.trim() || '';
              } else if (scorePart.includes('점')) {
                testScoreType = 'score';
                testScore = scorePart.replace(/점/g, '').trim();
              } else if (scorePart.includes('개')) {
                testScoreType = 'count';
                testScore = scorePart.replace(/개/g, '').trim();
              } else {
                testScore = scorePart;
              }
            } else {
              testId = rawTestVal;
            }
          }
          
          const currentSession = matchedStudent.todaySession || {};
          const newData: any = {
            completed_classwork_text: classworkText,
            homework_text: homeworkText,
            special_notes: specialNotes,
            test_id: testId,
            test_score: testScore,
            test_score_type: testScoreType,
            test_total_count: testTotalCount
          };
          const prevData: any = {
            completed_classwork_text: currentSession.completed_classwork_text || '',
            homework_text: currentSession.homework_text || '',
            special_notes: currentSession.special_notes || '',
            test_id: currentSession.test_id || '',
            test_score: currentSession.test_score || '',
            test_score_type: currentSession.test_score_type || 'score',
            test_total_count: currentSession.test_total_count || ''
          };

          sessionUpdates.push({
            studentId: matchedStudent.id,
            newData,
            prevData
          });
        }
        
        if (sessionUpdates.length === 0) {
          alert('오늘 출석부와 일치하는 학생 정보를 엑셀에서 찾지 못했습니다.');
          return;
        }
        
        if (onBatchSave) {
          await onBatchSave(sessionUpdates);
          alert(`엑셀 파일로부터 총 ${sessionUpdates.length}명 학생의 일지 정보가 성공적으로 복원/저장되었습니다!`);
        }
      } catch (err: any) {
        console.error(err);
        alert('엑셀 파일 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [students, onBatchSave]);

  return { handleImportExcel };
}
