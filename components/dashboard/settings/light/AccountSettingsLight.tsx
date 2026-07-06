'use client';

import { motion } from 'framer-motion';
import FeedbackPresetsLight from './FeedbackPresetsLight';
import SnippetSettingsLight from './SnippetSettingsLight';
import PasswordSettingsLight from './PasswordSettingsLight';

interface AccountSettingsProps {
  currentUser: any;
  onUpdateCurrentUser: (updates: any) => void;
  academyInfo: any;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
}

export default function AccountSettingsLight({ 
  currentUser, onUpdateCurrentUser, academyInfo, onUpdateAcademyInfo 
}: AccountSettingsProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-8 max-w-6xl mx-auto text-[#37352f]"
    >
      {/* 1. 피드백 프리셋 설정 */}
      <FeedbackPresetsLight 
        currentUser={currentUser}
        onUpdateCurrentUser={onUpdateCurrentUser}
        academyInfo={academyInfo}
        onUpdateAcademyInfo={onUpdateAcademyInfo}
      />

      {/* 2. 단축어 및 상용구 설정 */}
      <SnippetSettingsLight 
        currentUser={currentUser}
        onUpdateCurrentUser={onUpdateCurrentUser}
      />

      {/* 3. 비밀번호 변경 */}
      <PasswordSettingsLight 
        currentUser={currentUser}
      />
    </motion.div>
  );
}
