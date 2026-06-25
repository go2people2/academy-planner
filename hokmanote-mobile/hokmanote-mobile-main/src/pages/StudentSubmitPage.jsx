import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  Send, 
  AlertCircle, 
  Loader2, 
  CheckCircle2,
  Key
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ★ [핵심] App.jsx에서 보내준 'theme'을 받습니다!
export default function StudentSubmitPage({ studentData, handleLogout, theme, academyId }) {
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [bookName, setBookName] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [dbProblemList, setDbProblemList] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // PIN 변경 모달 상태
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinData, setChangePinData] = useState({ oldPin: '', newPin: '', confirmPin: '' });
  const [changingPin, setChangingPin] = useState(false);

  // ★ [핵심] 테마 색상 적용 도우미 (하드코딩된 색상 제거)
  const themeStyle = {
    text: { color: theme.primary },
    bg: { backgroundColor: theme.bg },
    button: { backgroundColor: theme.primary },
    border: { borderColor: theme.primary },
    ring: { '--tw-ring-color': theme.primary }, // 포커스 링 색상
    lightBg: { backgroundColor: theme.primary + '1A' } // 투명도 10% (버튼 배경용)
  };

  // 에러 메시지 자동 숨김
  useEffect(() => {
    if (!error && !successMsg) return;
    const timer = setTimeout(() => { setError(''); setSuccessMsg(''); }, 3000);
    return () => clearTimeout(timer);
  }, [error, successMsg]);

  // 교재 목록 가져오기
  useEffect(() => {
    const fetchBooks = async () => {
      if (!academyId) return; // academyId가 없으면 실행하지 않음
      setLoading(true);
      const { data: student } = await supabase.from('student_users').select('assigned_books').eq('id', studentData.id).single();
      // ★ 수정: academy_id 필터 추가
      const { data: catalog } = await supabase.from('problem_catalog').select('book_name').eq('academy_id', academyId);

      if (student && catalog) {
        const assignedList = student.assigned_books || [];
        const allBooks = [...new Set(catalog.map(item => item.book_name?.trim()))].sort();
        
        // 배정된 교재가 있으면 필터링, 없으면 전체 교재 보여주기
        const filtered = assignedList.length > 0 
          ? allBooks.filter(name => assignedList.includes(name))
          : allBooks;
          
        setBooks(filtered);
      }
      setLoading(false);
    };
    fetchBooks();
  }, [studentData.id, academyId]); // ★ 의존성 배열에 academyId 추가

  // 단원 목록 가져오기
  useEffect(() => {
    if (!bookName || !academyId) return;
    const fetchChapters = async () => {
      const { data } = await supabase
        .from('problem_catalog')
        .select('chapter_name')
        .eq('book_name', bookName)
        .eq('academy_id', academyId); // ★ 학원 필터 추가
      
      if (data) {
        // trim()을 적용하여 중복 제거 및 깔끔한 목록 생성
        const unique = [...new Set(data.map(i => i.chapter_name?.trim()))]
          .filter(Boolean)
          .sort();
        setChapters(unique);
      }
    };
    setChapterName('');
    setDbProblemList([]);
    fetchChapters();
  }, [bookName, academyId]); // ★ academyId 의존성 추가

  // 문제 번호 가져오기
  useEffect(() => {
    if (!bookName || !chapterName || !academyId) return;
    const fetchNumbers = async () => {
      const { data } = await supabase
        .from('problem_catalog')
        .select('problem_numbers')
        .eq('book_name', bookName)
        .eq('chapter_name', chapterName)
        .eq('academy_id', academyId) // ★ 학원 필터 추가
        .maybeSingle(); // .single() 대신 안전하게 maybeSingle() 사용
      
      if (data) setDbProblemList(data.problem_numbers || []);
    };
    setSelectedNumbers([]);
    fetchNumbers();
  }, [bookName, chapterName, academyId]); // ★ academyId 의존성 추가

  const toggleNumber = (num) => {
    setSelectedNumbers(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a,b) => Number(a)-Number(b)));
  };

  const handleSubmit = async () => {
    if (selectedNumbers.length === 0) { setError('문제를 선택해주세요.'); return; }
    setSubmitting(true);
    
    const fullName = studentData.grade ? `${studentData.name} (${studentData.grade})` : studentData.name;
    
    const submissionData = {
      student_id: studentData.id,
      student_name: fullName,
      teacher_id: studentData.teacher_id,
      academy_id: studentData.academy_id, // ★ [중요] 제출 데이터에도 '학원 꼬리표' 붙이기!
      book_name: bookName,
      chapter_name: chapterName,
      problem_numbers: selectedNumbers,
      memo: memo,
    };

    try {
      const { error: submitError } = await supabase.from('wrong_answer_submissions').insert([submissionData]);
      if (submitError) throw submitError;
      setSuccessMsg(`${selectedNumbers.length}개 문제가 제출되었습니다!`);
      setSelectedNumbers([]);
      setMemo('');
    } catch (err) {
      console.error('제출 오류:', err);
      setError('제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (changePinData.newPin !== changePinData.confirmPin) { setError('새 PIN이 일치하지 않습니다.'); return; }
    if (changePinData.newPin.length < 3 || changePinData.newPin.length > 6) { setError('새 PIN은 3~6자리여야 합니다.'); return; }
    setChangingPin(true);
    try {
      const { error: rpcError } = await supabase.rpc('change_student_pin', {
        student_id_input: studentData.id,
        old_pin_input: changePinData.oldPin,
        new_pin_input: changePinData.newPin
      });
      if (rpcError) throw rpcError;
      setSuccessMsg('PIN이 성공적으로 변경되었습니다!');
      setShowChangePinModal(false);
      setChangePinData({ oldPin: '', newPin: '', confirmPin: '' });
    } catch (err) {
      setError(err.message || 'PIN 변경 실패');
    } finally {
      setChangingPin(false);
    }
  };

  return (
    // ★ 배경색도 테마에 맞춰 변경
    <div className="min-h-screen p-4 pb-28 text-slate-800 transition-colors duration-500" style={themeStyle.bg}>
      
      {/* 헤더 */}
      <div className="max-w-md mx-auto flex justify-between items-center mb-6 bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
        <div>
          {/* ★ 이름 색상도 테마 적용 */}
          <h2 className="text-xl font-black" style={themeStyle.text}>
            {studentData.name} <span className="text-sm font-bold text-slate-400 ml-2">({studentData.grade})</span>
          </h2>
          <p className="text-xs font-bold text-slate-400 tracking-wider">ONLINE STUDY NOTE</p>
        </div>
        <div className="flex gap-2">
          {/* ★ 버튼 색상도 테마 적용 */}
          <button onClick={() => setShowChangePinModal(true)} className="p-3 rounded-2xl transition-colors hover:brightness-95" style={themeStyle.lightBg} title="PIN 변경">
            <Key size={20} style={themeStyle.text} />
          </button>
          <button onClick={handleLogout} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-colors" title="로그아웃">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* 교재/단원 선택 */}
      <div className="max-w-md mx-auto space-y-5">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-3">
          <h3 className="text-sm font-black text-slate-400 px-1 italic">Step 1. 교재 선택</h3>
          {/* ★ 포커스 링 색상 테마 적용 */}
          <select value={bookName} onChange={e => setBookName(e.target.value)} className={`w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 transition-all ${theme.ring}`} style={themeStyle.ring}>
            <option value="">교재를 선택하세요</option>
            {books.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={chapterName} onChange={e => setChapterName(e.target.value)} disabled={!bookName} className={`w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 transition-all disabled:opacity-50 ${theme.ring}`} style={themeStyle.ring}>
            <option value="">단원을 선택하세요</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* 문제 번호 선택 */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-sm font-black text-slate-400 italic font-mono uppercase tracking-tighter">Step 2. 번호 선택</h3>
            <span className="text-xs font-black px-3 py-1 rounded-full text-white" style={themeStyle.button}>
              {selectedNumbers.length}개 선택
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {dbProblemList.map(num => (
              <button key={num} onClick={() => toggleNumber(num)} 
                className={`aspect-square flex items-center justify-center border-2 rounded-xl font-black transition-all ${selectedNumbers.includes(num) ? 'text-white shadow-lg scale-105' : 'border-slate-50 text-slate-300'}`}
                // ★ 선택된 버튼 색상을 테마 색상으로 변경
                style={selectedNumbers.includes(num) ? { backgroundColor: theme.primary, borderColor: theme.primary } : {}}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-3 font-bold">
          <h3 className="text-sm font-black text-slate-400 px-1 italic">Step 3. 메모</h3>
          <textarea placeholder="선생님께 남길 메모 (선택)" value={memo} onChange={e => setMemo(e.target.value)} className={`w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-700 h-24 outline-none focus:ring-2 transition-all ${theme.ring}`} style={themeStyle.ring} />
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto font-black">
        {/* ★ 버튼 배경색 테마 적용 */}
        <button onClick={handleSubmit} disabled={submitting || selectedNumbers.length === 0} 
          className="w-full text-white p-5 rounded-3xl text-lg shadow-2xl hover:brightness-110 active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2"
          style={submitting || selectedNumbers.length === 0 ? {} : themeStyle.button}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />} 제출하기
        </button>
      </div>

      {/* PIN 변경 모달 */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowChangePinModal(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-800">PIN 변경</h3><button onClick={() => setShowChangePinModal(false)}>✕</button></div>
            <form onSubmit={handleChangePin} className="space-y-4">
              <input type="password" value={changePinData.oldPin} onChange={(e) => setChangePinData({...changePinData, oldPin: e.target.value.replace(/\D/g, '').slice(0,6)})} placeholder="현재 PIN" className={`w-full p-4 bg-slate-50 rounded-2xl text-center text-2xl tracking-widest outline-none focus:ring-2 ${theme.ring}`} style={themeStyle.ring} required />
              <input type="password" value={changePinData.newPin} onChange={(e) => setChangePinData({...changePinData, newPin: e.target.value.replace(/\D/g, '').slice(0,6)})} placeholder="새 PIN" className={`w-full p-4 bg-slate-50 rounded-2xl text-center text-2xl tracking-widest outline-none focus:ring-2 ${theme.ring}`} style={themeStyle.ring} required />
              <input type="password" value={changePinData.confirmPin} onChange={(e) => setChangePinData({...changePinData, confirmPin: e.target.value.replace(/\D/g, '').slice(0,6)})} placeholder="새 PIN 확인" className={`w-full p-4 bg-slate-50 rounded-2xl text-center text-2xl tracking-widest outline-none focus:ring-2 ${theme.ring}`} style={themeStyle.ring} required />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowChangePinModal(false)} className="flex-1 p-4 bg-slate-100 font-bold rounded-2xl">취소</button>
                {/* ★ 확인 버튼도 테마 적용 */}
                <button type="submit" disabled={changingPin} className="flex-1 p-4 text-white font-bold rounded-2xl" style={themeStyle.button}>확인</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 성공/실패 메시지 (테마 색상 적용) */}
      {successMsg && <div className="fixed top-24 left-1/2 -translate-x-1/2 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 animate-bounce" style={themeStyle.button}><CheckCircle2 size={18} /> {successMsg}</div>}
      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50"><AlertCircle size={18} /> {error}</div>}
    </div>
  );
}