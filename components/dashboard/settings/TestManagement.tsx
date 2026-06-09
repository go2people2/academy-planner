'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, UserPlus, Hash, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TestContentEditor from '../TestContentEditor';

interface TestManagementProps {
  academyId: string;
}

export default function TestManagement({ academyId }: TestManagementProps) {
  const [tests, setTests] = useState<any[]>([]);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<any>(null);

  const fetchTests = async () => {
    const { data, error } = await supabase.from('ams_tests').select('*').order('created_at', { ascending: false });
    if (!error && data) setTests(data);
  };

  useEffect(() => {
    fetchTests();
  }, [academyId]);

  const handleDeleteTest = async (id: string) => {
    if (!confirm('정말 이 테스트를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
    const { error } = await supabase.from('ams_tests').delete().eq('id', id);
    if (!error) fetchTests();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><BookOpen size={16} /> Test Content Management</h3>
        <button 
          onClick={() => { setEditingTest(null); setIsTestEditorOpen(true); }} 
          className="px-4 py-2 bg-blue-600 rounded-[2px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
        >
          <UserPlus size={14} /> Register New Test
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/[0.02] border border-white/5 rounded-lg border-dashed">
            <BookOpen size={40} className="text-gray-800 mx-auto mb-4 opacity-20" />
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest">No tests registered yet</p>
          </div>
        ) : (
          tests.map(test => (
            <div key={test.id} className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between group hover:border-blue-500/30 transition-all relative overflow-hidden">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-[4px] bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                  <Hash className="text-blue-400" size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-white truncate group-hover:text-blue-400 transition-colors">{test.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-blue-500 uppercase px-1.5 py-0.5 bg-blue-500/10 rounded-[2px]">{test.test_code}</span>
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">{test.total_questions} Questions</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <p className="text-[8px] font-bold text-gray-600 italic">Created at {new Date(test.created_at).toLocaleDateString()}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingTest(test); setIsTestEditorOpen(true); }} className="px-3 py-1.5 bg-white/5 hover:bg-blue-600 text-[9px] font-black uppercase text-gray-400 hover:text-white rounded-[2px] transition-all">Edit Solutions</button>
                  <button onClick={() => handleDeleteTest(test.id)} className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isTestEditorOpen && (
          <TestContentEditor 
            test={editingTest}
            onSave={fetchTests}
            onClose={() => setIsTestEditorOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
