import { useState, useEffect, useMemo, useRef } from 'react';
import { Student, TextbookOption } from '@/types/dashboard';

export interface UseStudentDetailDrawerProps {
  student: Student;
  availableTextbooks: TextbookOption[];
  onUpdateInfo: (studentId: string, fieldOrUpdates: string | any, value?: any) => void;
  onClose: () => void;
}

export function useStudentDetailDrawer({
  student,
  availableTextbooks,
  onUpdateInfo,
  onClose,
}: UseStudentDetailDrawerProps) {
  const [localSchedules, setLocalSchedules] = useState<{[key: string]: number[]}>(student.day_schedules || {});
  const [startTimes, setStartTimes] = useState<Record<string, string>>({});
  const [endTimes, setEndTimes] = useState<Record<string, string>>({});
  const [localDays, setLocalDays] = useState<string[]>(student.class_days || []);
  const [isHokmaPrintOpen, setIsHokmaPrintOpen] = useState(false);
  const [localName, setLocalName] = useState(student.name);
  const [localSchool, setLocalSchool] = useState(student.school || '');
  const [localGrade, setLocalGrade] = useState(student.grade);
  const [localCourse, setLocalCourse] = useState(student.course || 'C');
  const [localBookCourses, setLocalBookCourses] = useState<Record<string, string>>(student.book_courses || {});
  const [localClass, setLocalClass] = useState(student.class);
  const [localStudentPhone, setLocalStudentPhone] = useState('');
  const [localCreatedAt, setLocalCreatedAt] = useState('');
  const [localParentPhone, setLocalParentPhone] = useState('');
  const [localLoginSuffix, setLocalLoginSuffix] = useState('');
  const [localTeacherId, setLocalTeacherId] = useState(student.teacher_id || '');
  const [bookSearch, setBookSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [electiveCourses, setElectiveCourses] = useState<any[]>([]);

  // 완북 등록 모달 상태
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [doneBookCode, setDoneBookCode] = useState<string | null>(null);
  const [doneBookTitle, setDoneBookTitle] = useState('');
  const [doneStartGrade, setDoneStartGrade] = useState('');
  const [doneStartMonth, setDoneStartMonth] = useState('');
  const [doneEndGrade, setDoneEndGrade] = useState('');
  const [doneEndMonth, setDoneEndMonth] = useState('');
  const [doneCourse, setDoneCourse] = useState('C');
  const [hasStartInfo, setHasStartInfo] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else if (doneModalOpen) setDoneModalOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, showDeleteConfirm, doneModalOpen]);

  useEffect(() => {
    const schedules = student.day_schedules || {};
    const newStarts: Record<string, string> = {};
    const newEnds: Record<string, string> = {};

    const decodeTimeVal = (val: number) => {
      if (!val || val === 999) return '';
      if (val < 100) {
        const hour = val < 12 ? val + 12 : val;
        return `${hour.toString().padStart(2, '0')}:00`;
      }
      let h = Math.floor(val / 100);
      if (h < 12) h += 12;
      const m = (val % 100).toString().padStart(2, '0');
      return `${h.toString().padStart(2, '0')}:${m}`;
    };

    Object.keys(schedules).forEach(day => {
      const hours = schedules[day] || [];
      newStarts[day] = hours.length > 0 ? decodeTimeVal(hours[0]) : '';
      newEnds[day] = hours.length > 1 ? decodeTimeVal(hours[1]) : '';
    });

    setStartTimes(newStarts);
    setEndTimes(newEnds);
    setLocalSchedules(schedules);
    setLocalDays(student.class_days || []);
    setLocalName(student.name);
    setLocalSchool(student.school || '');
    setLocalGrade(student.grade);
    setLocalCourse(student.course || 'C');
    setLocalBookCourses(student.book_courses || {});
    setLocalClass(student.class);
    const rawPhone = student.phone || '';
    if (rawPhone.includes('(부모:')) {
      const parts = rawPhone.split('(부모:');
      setLocalStudentPhone(parts[0].trim());
      setLocalParentPhone(parts[1].replace(')', '').trim());
    } else {
      setLocalStudentPhone(rawPhone);
      setLocalParentPhone('');
    }
    setLocalTeacherId(student.teacher_id || '');
    setLocalLoginSuffix(student.login_suffix || '');

    if (student.created_at) {
      setLocalCreatedAt(student.created_at.slice(0, 10));
    } else {
      setLocalCreatedAt('');
    }

    const rawElective = student.book_courses?.['__elective_courses'];
    if (rawElective) {
      try {
        setElectiveCourses(JSON.parse(rawElective));
      } catch (e) {
        setElectiveCourses([]);
      }
    } else {
      setElectiveCourses([]);
    }
  }, [student.id, student.book_courses, student.created_at]);

  const handleSavePhone = (studentPhoneVal: string, parentPhoneVal: string) => {
    const sClean = studentPhoneVal.trim();
    const pClean = parentPhoneVal.trim();
    const combined = pClean ? `${sClean} (부모: ${pClean})` : sClean;
    onUpdateInfo(student.id, 'phone', combined);
  };

  const handleSaveLoginSuffix = (suffixVal: string) => {
    const clean = suffixVal.trim().replace(/[^0-9]/g, '');
    onUpdateInfo(student.id, 'login_suffix', clean || null);
  };

  const filteredBooks = useMemo(() => {
    return (availableTextbooks || []).filter(b => 
      b.title?.toLowerCase().includes(bookSearch.toLowerCase()) || 
      b.grade?.toLowerCase().includes(bookSearch.toLowerCase())
    );
  }, [availableTextbooks, bookSearch]);

  // 💡 [정규화 헬퍼] day_schedules의 키 집합이 항상 class_days의 부분집합이 되도록 보장
  const sanitizeSchedules = (schedules: Record<string, number[]>, days: string[]) => {
    const cleaned: Record<string, number[]> = {};
    days.forEach(d => {
      if (schedules[d]) cleaned[d] = schedules[d];
    });
    return cleaned;
  };

  const handleTimeChange = (day: string, startTimeStr: string, endTimeStr: string) => {
    setStartTimes(prev => ({ ...prev, [day]: startTimeStr }));
    setEndTimes(prev => ({ ...prev, [day]: endTimeStr }));

    if (startTimeStr === '' && endTimeStr === '') {
      const newDays = localDays.filter(d => d !== day);
      const newSchedules = sanitizeSchedules(localSchedules, newDays);
      setLocalSchedules(newSchedules);
      setLocalDays(newDays);

      onUpdateInfo(student.id, {
        day_schedules: newSchedules,
        class_days: newDays
      });
      return;
    }

    const isStartValid = startTimeStr && startTimeStr.length === 5 && startTimeStr.includes(':');
    const isEndValid = endTimeStr && endTimeStr.length === 5 && endTimeStr.includes(':');

    const finalStartVal = isStartValid 
      ? parseInt(startTimeStr.replace(':', '')) 
      : (localSchedules[day]?.[0] || 1600);
      
    const finalEndVal = isEndValid 
      ? parseInt(endTimeStr.replace(':', '')) 
      : (localSchedules[day]?.[1] || 1900);

    if (!isNaN(finalStartVal) && !isNaN(finalEndVal)) {
      const newDays = localDays.includes(day) ? localDays : [...localDays, day];
      const merged = { ...localSchedules, [day]: [finalStartVal, finalEndVal] };
      const newSchedules = sanitizeSchedules(merged, newDays);
      setLocalSchedules(newSchedules);
      setLocalDays(newDays);

      onUpdateInfo(student.id, {
        day_schedules: newSchedules,
        class_days: newDays
      });
    }
  };

  const handleDayToggle = (day: string) => {
    const isSelected = localDays.includes(day);
    const newDays = isSelected ? localDays.filter(d => d !== day) : [...localDays, day];
    setLocalDays(newDays);
    
    let merged = { ...localSchedules };
    if (isSelected) {
      delete merged[day];
      setStartTimes(prev => ({ ...prev, [day]: '' }));
      setEndTimes(prev => ({ ...prev, [day]: '' }));
    } else {
      merged[day] = [1600, 1900];
      setStartTimes(prev => ({ ...prev, [day]: '16:00' }));
      setEndTimes(prev => ({ ...prev, [day]: '19:00' }));
    }
    const newSchedules = sanitizeSchedules(merged, newDays);
    setLocalSchedules(newSchedules);

    onUpdateInfo(student.id, {
      class_days: newDays,
      day_schedules: newSchedules
    });
  };

  return {
    localSchedules,
    setLocalSchedules,
    startTimes,
    setStartTimes,
    endTimes,
    setEndTimes,
    localDays,
    setLocalDays,
    isHokmaPrintOpen,
    setIsHokmaPrintOpen,
    localName,
    setLocalName,
    localSchool,
    setLocalSchool,
    localGrade,
    setLocalGrade,
    localCourse,
    setLocalCourse,
    localBookCourses,
    setLocalBookCourses,
    localClass,
    setLocalClass,
    localStudentPhone,
    setLocalStudentPhone,
    localCreatedAt,
    setLocalCreatedAt,
    localParentPhone,
    setLocalParentPhone,
    localLoginSuffix,
    setLocalLoginSuffix,
    localTeacherId,
    setLocalTeacherId,
    bookSearch,
    setBookSearch,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownRef,
    showDeleteConfirm,
    setShowDeleteConfirm,
    electiveCourses,
    setElectiveCourses,
    doneModalOpen,
    setDoneModalOpen,
    doneBookCode,
    setDoneBookCode,
    doneBookTitle,
    setDoneBookTitle,
    doneStartGrade,
    setDoneStartGrade,
    doneStartMonth,
    setDoneStartMonth,
    doneEndGrade,
    setDoneEndGrade,
    doneEndMonth,
    setDoneEndMonth,
    doneCourse,
    setDoneCourse,
    hasStartInfo,
    setHasStartInfo,
    handleSavePhone,
    handleSaveLoginSuffix,
    filteredBooks,
    handleTimeChange,
    handleDayToggle,
  };
}
