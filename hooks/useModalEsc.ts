import { useEffect, useRef } from 'react';

/**
 * 💡 [전역 모달 스택 관리자]
 * 중첩 모달이 열릴 경우 가장 최상단(마지막으로 열린) 모달만 Esc 키에 반응하도록 보장합니다.
 */
const modalStack: { id: string; onClose: () => void; isSaving?: boolean }[] = [];

let isGlobalListenerAttached = false;

function handleGlobalKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  if (modalStack.length === 0) return;

  const topModal = modalStack[modalStack.length - 1];
  if (topModal.isSaving) {
    // 💡 저장 중일 때는 Esc 닫기 무시
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  topModal.onClose();
}

/**
 * 💡 [공통 모달 Esc 키 닫기 훅]
 * - 모달이 열릴 때(isOpen=true) 스택에 등록되고, 닫히거나 unmount 시 정리됩니다.
 * - input, textarea, select 포커스 상태에서도 정상 동작합니다.
 * - X 버튼과 동일한 onClose 콜백을 호출하여 일관된 닫기 처리를 보장합니다.
 */
export function useModalEsc({
  isOpen,
  onClose,
  isSaving = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  isSaving?: boolean;
}) {
  const idRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const onCloseRef = useRef(onClose);
  const isSavingRef = useRef(isSaving);

  onCloseRef.current = onClose;
  isSavingRef.current = isSaving;

  useEffect(() => {
    if (!isGlobalListenerAttached && typeof window !== 'undefined') {
      window.addEventListener('keydown', handleGlobalKeyDown, true); // 캡처링 단계에서 우선 수신
      isGlobalListenerAttached = true;
    }
  }, []);

  useEffect(() => {
    const id = idRef.current;

    if (isOpen) {
      modalStack.push({
        id,
        onClose: () => onCloseRef.current(),
        isSaving: isSavingRef.current,
      });
    }

    return () => {
      const idx = modalStack.findIndex(item => item.id === id);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
    };
  }, [isOpen]);

  // isSaving 변경 시 스택 내 속성 업데이트
  useEffect(() => {
    if (isOpen) {
      const modal = modalStack.find(item => item.id === idRef.current);
      if (modal) {
        modal.isSaving = isSaving;
      }
    }
  }, [isOpen, isSaving]);
}
