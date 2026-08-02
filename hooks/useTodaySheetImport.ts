import { useCallback } from 'react';
import * as XLSX from 'xlsx';

export interface UseTodaySheetImportParams {
  students: any[];
  allStudents?: any[];
  onBatchSave: (updates: any[], targetDate?: string) => Promise<void>;
  selectedDate?: string;
  onDateChange?: (newDate: string) => void;
}

/**
 * 📝 useTodaySheetImport: 아카2000 엑셀 일지 데이터 파일을 판독하여 해당 날짜의 출석부에 정확히 가져오기/복원
 */
export function useTodaySheetImport({
  students,
  allStudents = [],
  onBatchSave,
  selectedDate,
  onDateChange
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
        
        const headers: any = rows[0] || [];
        
        // 칼럼 위치 찾기 (아카2000 및 변형 엑셀 모두 호환)
        const findColIndex = (keywords: string[]) => {
          return headers.findIndex((h: any) => {
            const str = String(h || '').trim();
            return keywords.some(k => str.includes(k));
          });
        };

        const dateIdx = findColIndex(['수업일', '날짜', '일자', 'date']);
        const classNameIdx = findColIndex(['반명', '학생명', '이름', '학생']);
        const classworkIdx = findColIndex(['진도']);
        const homeworkIdx = findColIndex(['과제', '숙제']);
        const testIdx = findColIndex(['테스트', '시험']);
        const notesIdx = findColIndex(['기타', '특이사항', '메모']);

        if (classNameIdx === -1) {
          alert("올바른 엑셀 포맷이 아닙니다. '반명' 또는 '이름' 열이 존재해야 합니다.");
          return;
        }

        // 💡 1. 엑셀 파일 내의 수업일 날짜 추출
        let excelDateStr = '';
        if (dateIdx !== -1 && rows.length > 1) {
          const rawDateVal = rows[1][dateIdx];
          if (typeof rawDateVal === 'number') {
            // 엑셀 날짜 시리얼 번호 (예: 46232 -> 2026-07-29)
            const parsedDate = XLSX.SSF.parse_date_code(rawDateVal);
            if (parsedDate) {
              const y = parsedDate.y;
              const m = String(parsedDate.m).padStart(2, '0');
              const d = String(parsedDate.d).padStart(2, '0');
              excelDateStr = `${y}-${m}-${d}`;
            }
          } else if (typeof rawDateVal === 'string') {
            const dateMatch = rawDateVal.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
            if (dateMatch) {
              excelDateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
            }
          }
        }

        const targetSaveDate = excelDateStr || selectedDate || '';

        // 💡 2. 현재 선택된 날짜와 엑셀 날짜가 다를 경우 안내
        if (excelDateStr && selectedDate && excelDateStr !== selectedDate) {
          const confirmMove = confirm(
            `📌 올리신 엑셀 일지는 [${excelDateStr}] 자 데이터입니다.\n[${excelDateStr}] 자 출석부로 이동하여 일지를 적용할까요?`
          );
          if (!confirmMove) return;
        }

        const sessionUpdates: any[] = [];
        let matchedCount = 0;
        const candidatePool = (students && students.length > 0) ? students : allStudents;

        for (let i = 1; i < rows.length; i++) {
          const row: any = rows[i];
          if (!row || row.length === 0) continue;

          const classNameVal = String(row[classNameIdx] || '').trim();
          if (!classNameVal) continue;

          let detectedCourseName = '정규';
          let studentName = '';
          const parts = classNameVal.split('-').map(p => p.trim()).filter(Boolean);
          if (parts.length > 0) {
            // 특강 형태 '기하-심의결-L-월수' 인 경우 첫번째 요소('기하')가 과목명, 두번째 요소('심의결')가 학생 이름
            if (parts.length >= 3 && ['기하', '확통', '미적분', '수학1', '수학2', '특강', '방학특강', '확률과통계', '미적'].some(k => parts[0].includes(k))) {
              detectedCourseName = parts[0];
              studentName = parts[1];
            } else {
              studentName = parts[0];
            }
          }
          if (!studentName) continue;

          matchedCount++;

          // 오늘 출석부의 학생 목록에서 이름 및 과목(정규 vs 특강)으로 매칭
          const matchedStudent = candidatePool.find((s: any) => {
            const sName = String(s.name || '').trim().replace(/^특강\s*-\s*/, '');
            const isNameMatched = (sName === studentName || sName.startsWith(studentName) || studentName.startsWith(sName));
            if (!isNameMatched) return false;

            if (detectedCourseName !== '정규') {
              const sCourse = s.courseName || s.electiveCourse?.subject || '';
              return s.isSpecialClass && (sCourse.includes(detectedCourseName) || detectedCourseName.includes(sCourse));
            } else {
              return !s.isSpecialClass || s.courseName === '정규';
            }
          }) || (detectedCourseName !== '정규' 
            ? candidatePool.find((s: any) => {
                const sName = String(s.name || '').trim().replace(/^특강\s*-\s*/, '');
                return s.isSpecialClass && (sName === studentName || sName.startsWith(studentName) || studentName.startsWith(sName));
              })
            : null
          ) || candidatePool.find((s: any) => {
            const sName = String(s.name || '').trim().replace(/^특강\s*-\s*/, '');
            return sName === studentName || sName.startsWith(studentName) || studentName.startsWith(sName);
          });

          if (!matchedStudent) {
            console.log(`[Import Excel] 매칭되는 학생을 찾을 수 없음: ${studentName} (과목: ${detectedCourseName}, 원본: ${classNameVal})`);
            continue;
          }

          matchedCount++;

          const classworkText = classworkIdx !== -1 ? String(row[classworkIdx] || '').trim() : '';
          const homeworkText = homeworkIdx !== -1 ? String(row[homeworkIdx] || '').trim() : '';
          const specialNotes = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';
          const rawTestVal = testIdx !== -1 ? String(row[testIdx] || '').trim() : '';

          let testId = '';
          let testScore = '';
          let testScoreType = 'score';
          let testTotalCount = '';

          // 아카2000 테스트 형태 정밀 파싱 (예: <실력완성 5단원 10문항>100점 또는 9/10개)
          if (rawTestVal) {
            const matchBracket = rawTestVal.match(/^([<({][^>)]+[>)}])\s*(.*)$/);
            if (matchBracket) {
              testId = matchBracket[1].replace(/[<({>)}]/g, '').trim();
              const scorePart = matchBracket[2].trim();

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

          // test_result JSON 패킹
          const testResultObj = {
            completed: currentSession.test_completed ?? null,
            cut: currentSession.test_cut ?? 0,
            mission: specialNotes || currentSession.mission || '',
            todo_achievement: currentSession.todo_achievement ?? 0,
            score_type: testScoreType || 'score',
            total_count: testTotalCount ? parseInt(testTotalCount, 10) : 0,
            hw_checked_today: false,
            hw_passed_today: false
          };

          // 💡 핵심: classwork_text와 completed_classwork_text에 동시에 반영하여 화면에 100% 즉시 표시
          const newData: any = {
            classwork_text: classworkText || currentSession.classwork_text || '',
            completed_classwork_text: classworkText,
            homework_text: homeworkText,
            special_notes: specialNotes,
            test_status: testId || currentSession.test_status || currentSession.test_id || '',
            test_score: testScore || currentSession.test_score || '',
            test_result: JSON.stringify(testResultObj)
          };

          const prevData: any = {
            classwork_text: currentSession.classwork_text || '',
            completed_classwork_text: currentSession.completed_classwork_text || '',
            homework_text: currentSession.homework_text || '',
            special_notes: currentSession.special_notes || '',
            test_status: currentSession.test_status || currentSession.test_id || '',
            test_score: currentSession.test_score || '',
            test_result: currentSession.test_result || ''
          };

          sessionUpdates.push({
            studentId: matchedStudent.id,
            newData,
            prevData
          });
        }

        if (sessionUpdates.length === 0) {
          alert(`엑셀에서 ${matchedCount}건의 이름을 확인했으나, 해당 날짜 출석부의 학생 이름과 일치하는 항목을 찾지 못했습니다.`);
          return;
        }

        // 💡 3. 저장이 끝난 후 날짜 즉시 이동 및 DB 배치 저장 완료
        if (onBatchSave) {
          const isDateDifferent = excelDateStr && onDateChange && excelDateStr !== selectedDate;
          
          if (isDateDifferent) {
            onDateChange(excelDateStr);
          }

          // 화면 리렌더링 타이밍을 고려하여 비동기 저장 및 DOM Sync 수행
          setTimeout(async () => {
            await onBatchSave(sessionUpdates, targetSaveDate);

            // 💡 5. DOM Sync: 화면 셀 인풋 태그에 엑셀 값 즉시 주입
            setTimeout(() => {
              sessionUpdates.forEach(up => {
                const selectors = [
                  `[data-student-id="${up.studentId}"][data-col-id="completed_classwork_text"]`,
                  `[data-student-id="${up.studentId}"][data-col-id="classwork_text"]`
                ];
                selectors.forEach(sel => {
                  const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement;
                  if (el) el.value = up.newData.completed_classwork_text;
                });

                const hwEl = document.querySelector(`[data-student-id="${up.studentId}"][data-col-id="homework_text"]`) as HTMLInputElement | HTMLTextAreaElement;
                if (hwEl) hwEl.value = up.newData.homework_text;

                const noteEl = document.querySelector(`[data-student-id="${up.studentId}"][data-col-id="special_notes"]`) as HTMLInputElement | HTMLTextAreaElement;
                if (noteEl) noteEl.value = up.newData.special_notes;
              });
            }, 300);

            const targetDateLabel = excelDateStr ? `[${excelDateStr}] 자 ` : '';
            alert(`🎉 엑셀 일지로부터 총 ${sessionUpdates.length}명 학생의 ${targetDateLabel}수행진도, 오늘숙제, 테스트 정보가 성공적으로 반영되었습니다!`);
          }, isDateDifferent ? 200 : 0);
        }
      } catch (err: any) {
        console.error('[Import Excel Error]', err);
        alert('엑셀 파일 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [students, onBatchSave, selectedDate, onDateChange]);

  return { handleImportExcel };
}



