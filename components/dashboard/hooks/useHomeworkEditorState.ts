import { useState, useEffect, useRef, useCallback } from 'react';
import { HomeworkItem } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';
import { openMediaPdf, AcademyInfoMediaParam } from '@/lib/mediaUrl';

export function useHomeworkEditorState({
  student,
  homeworkJson,
  onClose,
  academyInfo,
}: {
  student?: any;
  homeworkJson: HomeworkItem[];
  onClose: (finalJson?: HomeworkItem[]) => void;
  academyInfo?: AcademyInfoMediaParam;
}) {
  const [mounted, setMounted] = useState(false);
  const [unitDataMap, setUnitDataMap] = useState<Record<string, any[]>>({});
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [pdfLinks, setPdfLinks] = useState<Record<string, { pdfUrl?: string; answerUrl?: string; explanationUrl?: string }>>({});
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);

  const [items, setItems] = useState<HomeworkItem[]>(homeworkJson);
  const itemsRef = useRef<HomeworkItem[]>(homeworkJson);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const loadPdfLinks = async () => {
      if (!student?.academy_id) return;
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/textbooks/pdf?academyId=${student.academy_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const mapped: Record<string, { pdfUrl?: string; answerUrl?: string; explanationUrl?: string }> = {};
          (data.pdfs || []).forEach((p: any) => {
            mapped[p.bookcode] = {
              pdfUrl: p.pdf_url || '',
              answerUrl: p.answer_url || '',
              explanationUrl: p.explanation_url || ''
            };
          });
          setPdfLinks(mapped);
        }
      } catch (e) {
        console.error('Failed to load PDFs in HomeworkEditor:', e);
      }
    };
    loadPdfLinks();
  }, [student?.academy_id]);

  const startRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchAllUnits = useCallback(async () => {
    setIsLoadingUnits(true);
    try {
      const res = await fetch('/api/textbooks/unit-page');
      if (res.ok) {
        const allUnits = await res.json();
        const mapped: Record<string, any[]> = {};
        allUnits.forEach((u: any) => {
          const code = u.bookcode; 
          if (!mapped[code]) mapped[code] = [];
          mapped[code].push(u);
        });
        setUnitDataMap(mapped);
      }
    } catch (e) {
      console.error('Failed to fetch unit-page:', e);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchAllUnits();

    const handleModalKeyDown = (e: KeyboardEvent) => {
      const isAltNumber = e.altKey && !isNaN(parseInt(e.key));
      const isEscape = e.key === 'Escape';
      const isCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);

      if (isAltNumber || isEscape || isCtrlEnter) {
        e.stopPropagation();
        if (isAltNumber) {
          const idx = parseInt(e.key) - 1;
          if (startRefs.current[idx]) {
            e.preventDefault();
            startRefs.current[idx]?.focus();
            startRefs.current[idx]?.select();
          }
        } else if (isEscape) {
          e.preventDefault();
          onClose(itemsRef.current);
        } else if (isCtrlEnter) {
          e.preventDefault();
          onClose(itemsRef.current);
        }
        return;
      }

      if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [onClose, fetchAllUnits]);

  const commitPageChange = useCallback((idx: number, start: string, end: string, note?: string) => {
    const newHw = [...itemsRef.current];
    const item = { ...newHw[idx] };
    const units = unitDataMap[item.book_name] || [];

    item.start_page = start;
    item.end_page = end;
    if (note !== undefined) {
      item.note = note;
    }

    const sNum = parseInt(start.replace(/\D/g, ''));
    const eNum = parseInt(end.replace(/\D/g, ''));

    const isStartValid = !isNaN(sNum);
    const isEndValid = !isNaN(eNum);

    const activeNote = item.note ? ` ${item.note}` : '';

    if (isStartValid || isEndValid) {
      const searchStart = isStartValid ? sNum : eNum;
      const searchEnd = isEndValid ? eNum : sNum;

      const matchedUnits = units.filter(u => {
        const uStart = parseInt(String(u.start_page).replace(/\D/g, ''));
        const uEnd = parseInt(String(u.end_page).replace(/\D/g, ''));
        return (uStart <= searchEnd && uEnd >= searchStart);
      });

      const uniqueUnitNames = Array.from(new Set(matchedUnits.map(u => u.unit)));
      const unitText = uniqueUnitNames.join(', ');
      
      let rangeText = "";
      if (isStartValid && isEndValid) {
        rangeText = (sNum === eNum) ? `p${sNum}` : `p${sNum}~${eNum}`;
      } else if (isStartValid) {
        rangeText = `p${sNum}`;
      } else {
        rangeText = `p${eNum}`;
      }

      item.range = unitText ? `${unitText} ${rangeText}${activeNote}` : `${rangeText}${activeNote}`;
      item.units = uniqueUnitNames;
    } else {
      const startText = start ? (isNaN(Number(start)) ? start : `p${start}`) : '';
      const endText = end ? `~${end}` : '';
      item.range = `${startText}${endText}${activeNote}`;
      item.units = [];
    }

    newHw[idx] = item;
    setItems(newHw);
  }, [unitDataMap]);

  const navigateInput = useCallback((idx: number, type: 'start' | 'end', key: string) => {
    if (key === 'ArrowRight' && type === 'start') {
      endRefs.current[idx]?.focus();
      endRefs.current[idx]?.select();
    } else if (key === 'ArrowLeft' && type === 'end') {
      startRefs.current[idx]?.focus();
      startRefs.current[idx]?.select();
    } else if (key === 'ArrowDown') {
      const targetIdx = idx + 1;
      if (type === 'start' && startRefs.current[targetIdx]) { startRefs.current[targetIdx]?.focus(); startRefs.current[targetIdx]?.select(); }
      else if (type === 'end' && endRefs.current[targetIdx]) { endRefs.current[targetIdx]?.focus(); endRefs.current[targetIdx]?.select(); }
    } else if (key === 'ArrowUp') {
      const targetIdx = idx - 1;
      if (type === 'start' && startRefs.current[targetIdx]) { startRefs.current[targetIdx]?.focus(); startRefs.current[targetIdx]?.select(); }
      else if (type === 'end' && endRefs.current[targetIdx]) { endRefs.current[targetIdx]?.focus(); endRefs.current[targetIdx]?.select(); }
    }
  }, []);

  const openFastPdf = useCallback((url: string) => {
    openMediaPdf(url, academyInfo);
  }, [academyInfo]);

  return {
    mounted,
    unitDataMap,
    isLoadingUnits,
    pdfLinks,
    activePdfUrl,
    setActivePdfUrl,
    items,
    setItems,
    itemsRef,
    startRefs,
    endRefs,
    commitPageChange,
    navigateInput,
    openFastPdf,
  };
}
