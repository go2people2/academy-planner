import { useRef, useCallback } from 'react';
import { syncTodaySheetDom } from '@/lib/todaySheetDomSync';
import { matchRowIdentity, extractRealStudentId } from '@/lib/rowIdentity';

interface UndoRedoUpdate {
  studentId: string;
  newData: any;
  prevData: any;
}

interface UseTodaySheetUndoRedoParams {
  setStudents: React.Dispatch<React.SetStateAction<any[]>>;
  onSave: (studentId: string, payload: any) => Promise<any> | void;
  onUpdateStudentInfo?: (studentId: string, fieldOrUpdates: any, value?: any) => Promise<any> | void;
}

export function useTodaySheetUndoRedo({
  setStudents,
  onSave,
  onUpdateStudentInfo,
}: UseTodaySheetUndoRedoParams) {
  const undoStackRef = useRef<UndoRedoUpdate[][]>([]);
  const redoStackRef = useRef<UndoRedoUpdate[][]>([]);

  const pushToUndoStack = useCallback((updates: UndoRedoUpdate[]) => {
    const validUpdates = updates.filter(u => {
      return Object.keys(u.newData).some(key => {
        return String(u.newData[key] || '') !== String(u.prevData?.[key] || '');
      });
    });
    if (validUpdates.length > 0) {
      undoStackRef.current.push(validUpdates);
      redoStackRef.current = []; // 새로운 동작 발생 시 redo 초기화
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return;
    const updates = undoStackRef.current.pop();
    if (!updates || updates.length === 0) return;

    // 💡 실제 변경된 필드만 추출하여 되돌림 (전체 세션이 아닌 변경 필드만)
    const undoUpdates = updates.map((u: any) => {
      const changedKeys = Object.keys(u.newData);
      const restoreData: any = {};
      changedKeys.forEach((key: string) => {
        restoreData[key] = u.prevData?.[key] ?? '';
      });
      return {
        studentId: u.studentId,
        newData: restoreData,
        prevData: { ...u.newData }
      };
    });

    setStudents((prev: any[]) => prev.map(s => {
      const update = undoUpdates.find((u: any) => matchRowIdentity(s, u.studentId));
      if (update) {
        return {
          ...s,
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));

    redoStackRef.current.push(updates);

    const invMap: Record<string, string> = { 
      'test_id': 'test_id',
      'test_status': 'test_id', 
      'test_score': 'test_score', 
      'classwork_text': 'classwork', 
      'completed_classwork_text': 'completed_classwork', 
      'homework_text': 'assign', 
      'next_quiz_text': 'next_quiz', 
      'mission': 'mission', 
      'special_notes': 'notes',
      'management_notes': 'management_notes',
      'attendance_status': 'attendance'
    };
    const affectedColIds = new Set<string>();
    undoUpdates.forEach((u: any) => {
      Object.keys(u.newData).forEach((key: string) => {
        const colId = invMap[key];
        if (colId) affectedColIds.add(colId);
      });
    });

    syncTodaySheetDom(undoUpdates, Array.from(affectedColIds));

    await Promise.all(undoUpdates.map(async (u: any) => {
      if (Object.keys(u.newData).length > 0) {
        await onSave(extractRealStudentId(u.studentId), u.newData);
      }
    }));
  }, [setStudents, onSave, onUpdateStudentInfo]);

  const handleRedo = useCallback(async () => {
    if (redoStackRef.current.length === 0) return;
    const updates = redoStackRef.current.pop();
    if (!updates || updates.length === 0) return;

    setStudents((prev: any[]) => prev.map(s => {
      const update = updates.find((u: any) => matchRowIdentity(s, u.studentId));
      if (update) {
        return {
          ...s,
          todaySession: {
            ...(s.todaySession || {}),
            ...update.newData
          }
        };
      }
      return s;
    }));

    undoStackRef.current.push(updates);

    const invMap: Record<string, string> = { 
      'test_id': 'test_id',
      'test_status': 'test_id', 
      'test_score': 'test_score', 
      'classwork_text': 'classwork', 
      'completed_classwork_text': 'completed_classwork', 
      'homework_text': 'assign', 
      'next_quiz_text': 'next_quiz', 
      'mission': 'mission', 
      'special_notes': 'notes',
      'management_notes': 'management_notes',
      'attendance_status': 'attendance'
    };
    const affectedColIds = new Set<string>();
    updates.forEach((u: any) => {
      Object.keys(u.newData).forEach((key: string) => {
        const colId = invMap[key];
        if (colId) affectedColIds.add(colId);
      });
    });

    syncTodaySheetDom(updates, Array.from(affectedColIds));

    await Promise.all(updates.map(async (u: any) => {
      if (Object.keys(u.newData).length > 0) {
        await onSave(extractRealStudentId(u.studentId), u.newData);
      }
    }));
  }, [setStudents, onSave, onUpdateStudentInfo]);

  return {
    undoStackRef,
    redoStackRef,
    pushToUndoStack,
    handleUndo,
    handleRedo,
  };
}
