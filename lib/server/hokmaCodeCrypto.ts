import * as crypto from 'crypto';

// 💡 1. 혼동하기 쉬운 문자(0, O, 1, I, L)를 제외한 안전한 31자 문자 집합
// 숫자(8개): 2, 3, 4, 5, 6, 7, 8, 9
// 알파벳(23개): A, B, C, D, E, F, G, H, J, K, M, N, P, Q, R, S, T, U, V, W, X, Y, Z
export const HOKMA_SAFE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SAFE_CHARS_LEN = HOKMA_SAFE_CHARS.length;

// Rejection Sampling 한계값: 256 이하에서 SAFE_CHARS_LEN의 최대 배수로 동적 계산 (예: 31자 기준 Math.floor(256/31)*31 = 248)
// 0 ~ (REJECTION_LIMIT - 1) 범위의 바이트 값만 사용하여 Modulo Bias(나머지 연산 편향)를 제거하고 균등 난수를 추출합니다.
export const REJECTION_LIMIT = Math.floor(256 / SAFE_CHARS_LEN) * SAFE_CHARS_LEN;

/**
 * 암호학적으로 안전한 무편향(Unbiased) 16자리 난수 코드를 생성합니다.
 * 형식: HN-XXXX-XXXX-XXXX-XXXX
 * 경우의 수: 31^16 ≈ 8.71 × 10^23
 */
export function generateHokmaActivationCode(): {
  rawCode: string;
  codePrefix: string;
} {
  const chars: string[] = [];
  while (chars.length < 16) {
    const randomBytes = crypto.randomBytes(16);
    for (let i = 0; i < randomBytes.length && chars.length < 16; i++) {
      const val = randomBytes[i];
      if (val < REJECTION_LIMIT) {
        chars.push(HOKMA_SAFE_CHARS[val % SAFE_CHARS_LEN]);
      }
    }
  }

  const part1 = chars.slice(0, 4).join('');
  const part2 = chars.slice(4, 8).join('');
  const part3 = chars.slice(8, 12).join('');
  const part4 = chars.slice(12, 16).join('');

  const rawCode = `HN-${part1}-${part2}-${part3}-${part4}`;
  const codePrefix = `HN-${part1}`;

  return { rawCode, codePrefix };
}

/**
 * 입력된 코드를 표준 형식으로 정규화합니다.
 * - 양끝 공백 제거 및 대문자 변환
 * - 하이픈 및 특수문자 정돈
 */
export function normalizeHokmaActivationCode(code: string): string {
  if (!code) return '';
  const trimmed = code.trim().toUpperCase();
  
  // 이미 표준 포맷(HN-XXXX-XXXX-XXXX-XXXX 또는 HN-XXXX-XXXX)인 경우 대문자 트리밍 유지
  if (/^HN(-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}){2,4}$/.test(trimmed)) {
    return trimmed;
  }

  // 💡 안전한 재포맷팅: 잘못된 문자를 임의로 삭제하지 않고,
  // 오직 공백과 하이픈만 제거했을 때 전체 문자가 정확히 유효한 집합(HN + 8자리 또는 16자리)인 경우에만 하이픈을 표준 삽입합니다.
  const withoutSeparators = trimmed.replace(/[-\s]/g, '');
  const isValidLegacyAlphanumeric = /^HN[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(withoutSeparators);
  const isValidNewAlphanumeric = /^HN[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$/.test(withoutSeparators);

  if (isValidLegacyAlphanumeric || isValidNewAlphanumeric) {
    const body = withoutSeparators.substring(2);
    const chunks = body.match(/.{1,4}/g);
    if (chunks) {
      return `HN-${chunks.join('-')}`;
    }
  }

  // 유효하지 않은 문자(0, O, 1, I, L, 특수문자 등)가 포함된 경우 임의 제거/수정하지 않고 원문 그대로 반환하여 인증 거절을 유도
  return trimmed;
}

/**
 * 활성화 코드의 SHA-256 검증용 해시를 계산합니다.
 * 기존 앱 인증 엔드포인트(app/api/app/v1/activate/route.ts)와 100% 동일한 Pepper와 알고리즘을 사용합니다.
 */
export function hashHokmaActivationCode(code: string): string {
  const normalized = normalizeHokmaActivationCode(code);
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) {
    throw new Error('서버 필수 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.');
  }
  return crypto.createHash('sha256').update(normalized + pepper).digest('hex');
}

/**
 * 서버 환경변수 키 조회 및 검증 헬퍼
 * 키 버전(key_version) 지원:
 * - version 1: HOKMANOTE_CODE_ENCRYPTION_KEY (기본)
 * - 향후 로테이션 시: HOKMANOTE_CODE_ENCRYPTION_KEY_V2 등 매핑 지원
 */
function getEncryptionKey(version = 1): Buffer {
  let envKeyStr = '';
  if (version === 1) {
    envKeyStr = process.env.HOKMANOTE_CODE_ENCRYPTION_KEY || '';
  } else {
    envKeyStr = process.env[`HOKMANOTE_CODE_ENCRYPTION_KEY_V${version}`] || '';
  }

  if (!envKeyStr) {
    throw new Error(
      `서버에 설치 코드 암호화 키(HOKMANOTE_CODE_ENCRYPTION_KEY${version > 1 ? `_V${version}` : ''}) 환경변수가 설정되지 않았습니다.`
    );
  }

  // 64자리 Hex 문자열이거나 32바이트 바이너리 지원
  let keyBuffer: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(envKeyStr)) {
    keyBuffer = Buffer.from(envKeyStr, 'hex');
  } else if (envKeyStr.length === 32) {
    keyBuffer = Buffer.from(envKeyStr, 'utf-8');
  } else {
    throw new Error(
      'HOKMANOTE_CODE_ENCRYPTION_KEY의 길이가 올바르지 않습니다. 32바이트(64자리 Hex 문자열)여야 합니다.'
    );
  }

  return keyBuffer;
}

/**
 * 암호화 환경변수가 설정되어 있는지 안전하게 확인합니다.
 */
export function isCodeEncryptionConfigured(): boolean {
  try {
    getEncryptionKey(1);
    return true;
  } catch {
    return false;
  }
}

/**
 * AES-256-GCM 인증된 암호화(Authenticated Encryption)
 */
export function encryptActivationCode(code: string, keyVersion = 1): {
  encryptedCode: string;
  iv: string;
  authTag: string;
  keyVersion: number;
} {
  const key = getEncryptionKey(keyVersion);
  const iv = crypto.randomBytes(12); // GCM 표준 12바이트(96비트) IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(code, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encryptedCode: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion,
  };
}

/**
 * AES-256-GCM 복호화 및 인증 태그 검증
 */
export function decryptActivationCode(
  encryptedCode: string,
  ivBase64: string,
  authTagBase64: string,
  keyVersion = 1
): string {
  const key = getEncryptionKey(keyVersion);
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedCode, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
