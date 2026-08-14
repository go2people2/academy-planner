/**
 * 미디어 서버 주소 및 PDF 열기 공통 유틸리티
 */

export interface AcademyInfoMediaParam {
  operation_settings?: {
    base_server_url?: string;
  };
  [key: string]: any;
}

/**
 * 유효한 미디어 서버 기본 주소를 결정하는 유틸리티
 * 1. [개발 환경 전용] process.env.NODE_ENV !== 'production' 일 때 ams_dev_media_server_url 최우선 적용
 * 2. [학원 공용 DB] academyInfo.operation_settings.base_server_url 적용
 * 3. [운영 환경 브라우저] localStorage ams_base_server_url 적용
 * 4. 주소가 없으면 특정 IP 하드코딩 없이 빈 문자열('') 반환
 */
export const getEffectiveBaseServerUrl = (academyInfo?: AcademyInfoMediaParam): string => {
  // 1. [학원 공용 DB 설정] Settings 화면에서 등록된 학원 기본 서버 주소 (최우선 반영)
  if (academyInfo?.operation_settings?.base_server_url) {
    const dbUrl = String(academyInfo.operation_settings.base_server_url).trim();
    if (dbUrl) {
      // 로컬스토리지에도 최신 DB 주소를 자동 업데이트 동기화
      if (typeof window !== 'undefined') {
        localStorage.setItem('ams_base_server_url', dbUrl);
      }
      return dbUrl;
    }
  }

  // 2. [개발 환경 전용] 내 로컬 개발 PC Override (ams_dev_media_server_url)
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    const devOverride = localStorage.getItem('ams_dev_media_server_url');
    if (devOverride && devOverride.trim()) {
      return devOverride.trim();
    }
  }

  // 3. 브라우저 저장소 (운영 환경 캐시 ams_base_server_url)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ams_base_server_url');
    if (saved && saved.trim()) return saved.trim();
  }

  // 4. 주소가 설정되어 있지 않으면 빈 문자열 반환
  return '';
};

/**
 * 🎬 동영상 파일 여부 자동 감지 헬퍼
 */
export const isVideoMediaUrl = (urlOrPath: string): boolean => {
  if (!urlOrPath) return false;
  const clean = urlOrPath.toLowerCase().trim();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m3u8') ||
    clean.includes('/videos/') ||
    clean.includes('/video/')
  );
};

/**
 * 🎬 동영상 전용 안전 열기 공통 유틸리티 (전역 커스텀 VideoPlayerModal 연동)
 */
export const openMediaVideo = (
  rawUrlOrPath?: string, 
  academyInfo?: AcademyInfoMediaParam,
  title?: string,
  timestampsText?: string
) => {
  if (!rawUrlOrPath || !rawUrlOrPath.trim()) return;
  const cleanP = rawUrlOrPath.trim();

  let fullUrl = cleanP;

  // 상대 경로인 경우 미디어 서버 주소와 안전 결합
  if (!cleanP.startsWith('http://') && !cleanP.startsWith('https://')) {
    const baseServerUrl = getEffectiveBaseServerUrl(academyInfo);
    const base = (baseServerUrl || '').trim().replace(/\/+$/, '');
    if (!base || (!base.startsWith('http://') && !base.startsWith('https://'))) {
      alert('미디어 서버 주소가 설정되지 않았습니다. Settings에서 미디어 서버 주소를 먼저 설정해 주세요.');
      return;
    }
    const relative = cleanP.startsWith('/') ? cleanP : `/${cleanP}`;
    fullUrl = `${base}${relative}`;
  }

  // 전역 커스텀 VideoPlayerModal 오픈 이벤트 발송
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ams-open-video-modal', {
        detail: {
          videoUrl: fullUrl,
          title: title || '학습 동영상 플레이어',
          timestampsText: timestampsText || ''
        }
      })
    );
  }
};

/**
 * PDF / 미디어 파일 안전 열기 공통 유틸리티
 * 
 * - 동영상 파일(.mp4 등)인 경우 전역 VideoPlayerModal 팝업으로 자동 전환
 * - 전체 URL(http://, https://)은 변형 없이 그대로 오픈
 * - Google Drive 공유 링크는 기존 호환용 고속 뷰어 주소로 변환하여 오픈
 * - 상대 경로(/pdf/파일명.pdf)는 유효한 미디어 서버 주소와 결합하여 절대 URL로만 오픈
 */
export const openMediaPdf = (rawUrlOrPath?: string, academyInfo?: AcademyInfoMediaParam) => {
  if (!rawUrlOrPath || !rawUrlOrPath.trim()) return;
  const cleanP = rawUrlOrPath.trim();

  // 0. 동영상인 경우 전역 VideoPlayerModal 커스텀 플레이어로 팝업 오픈
  if (isVideoMediaUrl(cleanP)) {
    openMediaVideo(cleanP, academyInfo);
    return;
  }

  // 1. Google Drive 공유 링크 기존 호환 처리
  const driveMatch = cleanP.match(/\/d\/([a-zA-Z0-9-_]+)/) || cleanP.match(/id=([a-zA-Z0-9-_]+)/);
  if (driveMatch && driveMatch[1]) {
    window.open(`https://drive.google.com/file/d/${driveMatch[1]}/view`, '_blank');
    return;
  }

  // 2. 이미 전체 HTTP/HTTPS URL인 경우 그대로 오픈
  if (cleanP.startsWith('http://') || cleanP.startsWith('https://')) {
    window.open(cleanP, '_blank');
    return;
  }

  // 3. 상대 경로인 경우 현재 유효한 미디어 서버 주소와 안전 결합
  const baseServerUrl = getEffectiveBaseServerUrl(academyInfo);
  const base = (baseServerUrl || '').trim().replace(/\/+$/, '');

  // 4. 미디어 서버 주소가 없으면 상대 경로를 직접 window.open에 넘기지 않고 안내 표시
  if (!base || (!base.startsWith('http://') && !base.startsWith('https://'))) {
    alert('미디어 서버 주소가 설정되지 않았습니다. Settings(또는 집 개발 모드 전용 입력창)에서 미디어 서버 주소를 먼저 설정해 주세요.');
    return;
  }

  const relative = cleanP.startsWith('/') ? cleanP : `/${cleanP}`;
  const fullUrl = `${base}${relative}`;
  window.open(fullUrl, '_blank');
};
