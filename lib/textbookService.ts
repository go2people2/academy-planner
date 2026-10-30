import { createClient } from '@supabase/supabase-js';
import { fetchTextbookMasterList, fetchTextbookUnits, fetchAllTextbookUnits, TextbookMaster } from '@/lib/googleSheets';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const HOKMA_ACADEMY_ID = 'aa57bded-2adb-459f-a51b-79d8e033008a';

/**
 * 💡 서버 전용 전환 플래그
 * 환경변수 USE_SUPABASE_TEXTBOOKS="false" 설정 시 구글 시트 모드로 강제 동작합니다.
 * 환경변수 변경 시 개발 환경은 서버 재시작, 배포 환경은 재배포가 필요합니다.
 */
export function isSupabaseTextbookEnabled(): boolean {
  return process.env.USE_SUPABASE_TEXTBOOKS !== 'false';
}

export interface UnitResponseItem {
  bookcode?: string;
  unit: string;
  start_page: string;
  end_page: string;
}

/**
 * 💡 해당 학원이 접근 가능한 유효 bookcode 목록을 가져옵니다.
 */
async function getAccessibleBookcodes(academyId: string): Promise<Set<string>> {
  // 1. 공용 교재 및 자체 교재 조회
  const { data: directBooks, error: directErr } = await supabaseAdmin
    .from('ams_textbooks')
    .select('bookcode, share_scope, created_by_academy_id')
    .eq('status', '활성')
    .or(`and(share_scope.eq.public,share_status.eq.approved),created_by_academy_id.eq.${academyId}`);

  if (directErr) throw directErr;

  const accessibleSet = new Set<string>((directBooks || []).map(b => b.bookcode));

  // 2. 유효한 지정 공유 교재(share_scope = 'group') 조회
  const nowIso = new Date().toISOString();
  const { data: sharedBooks, error: shareErr } = await supabaseAdmin
    .from('ams_textbook_shares')
    .select('bookcode, valid_until, is_revoked')
    .eq('target_academy_id', academyId)
    .eq('is_revoked', false);

  if (!shareErr && sharedBooks && sharedBooks.length > 0) {
    const candidateCodes = sharedBooks
      .filter(s => !s.valid_until || s.valid_until > nowIso)
      .map(s => s.bookcode);

    if (candidateCodes.length > 0) {
      // 부모 교재의 share_scope='group' 및 status='활성' 동시 검증
      const { data: groupBooks } = await supabaseAdmin
        .from('ams_textbooks')
        .select('bookcode')
        .in('bookcode', candidateCodes)
        .eq('share_scope', 'group')
        .eq('status', '활성');

      if (groupBooks) {
        for (const gb of groupBooks) {
          accessibleSet.add(gb.bookcode);
        }
      }
    }
  }

  return accessibleSet;
}

/**
 * 💡 학원별 활성화 상태(ON/OFF) 및 별칭 매핑을 가져옵니다.
 */
async function getAcademyBookSettings(academyId: string): Promise<Map<string, { is_enabled: boolean; custom_title?: string }>> {
  const { data, error } = await supabaseAdmin
    .from('ams_academy_books')
    .select('bookcode, is_enabled, custom_title')
    .eq('academy_id', academyId);

  const map = new Map<string, { is_enabled: boolean; custom_title?: string }>();
  if (!error && data) {
    for (const row of data) {
      map.set(row.bookcode, {
        is_enabled: row.is_enabled,
        custom_title: row.custom_title || undefined,
      });
    }
  }
  return map;
}

/**
 * 💡 학원 소속에 맞는 마스터 교재 목록 조회
 */
export async function getVisibleTextbookMasterList(academyId: string): Promise<TextbookMaster[]> {
  if (!isSupabaseTextbookEnabled()) {
    return getGoogleSheetsFallbackMaster(academyId);
  }

  try {
    const accessibleCodes = await getAccessibleBookcodes(academyId);
    if (accessibleCodes.size === 0) return [];

    const settingsMap = await getAcademyBookSettings(academyId);

    // 전체 활성 교재 상세 조회
    const { data: books, error } = await supabaseAdmin
      .from('ams_textbooks')
      .select('bookcode, title, grade, status, e_period')
      .eq('status', '활성')
      .in('bookcode', Array.from(accessibleCodes))
      .order('bookcode', { ascending: true });

    if (error) throw error;

    // 각 교재별 등록된 단원 수 조회
    const { data: unitRows } = await supabaseAdmin
      .from('ams_textbook_units')
      .select('bookcode')
      .in('bookcode', Array.from(accessibleCodes));

    const unitCountMap: Record<string, number> = {};
    for (const u of unitRows || []) {
      unitCountMap[u.bookcode] = (unitCountMap[u.bookcode] || 0) + 1;
    }

    // 오답노트(호크마노트 problem_catalog_v3) 구축 여부 조회
    const { data: catalogRows } = await supabaseAdmin
      .from('problem_catalog_v3')
      .select('bookcode')
      .in('bookcode', Array.from(accessibleCodes));

    const catalogSet = new Set((catalogRows || []).map(r => r.bookcode));

    const result: TextbookMaster[] = [];
    for (const b of books || []) {
      const setting = settingsMap.get(b.bookcode);
      const isEnabled = setting ? setting.is_enabled !== false : true;

      result.push({
        bookcode: b.bookcode,
        title: b.title,
        custom_title: setting?.custom_title || undefined,
        is_enabled: isEnabled,
        grade: b.grade || '',
        status: b.status,
        ePeriod: b.e_period || '',
        unit_count: unitCountMap[b.bookcode] || 0,
        has_hn: catalogSet.has(b.bookcode),
      });
    }

    return result;
  } catch (err) {
    console.error('❌ Supabase 교재 마스터 조회 실패 -> 구글 시트 폴백 시도:', err);
    return getGoogleSheetsFallbackMaster(academyId);
  }
}

/**
 * 💡 단건 교재의 단원 목록 조회
 */
export async function getVisibleTextbookUnits(academyId: string, bookcode: string): Promise<UnitResponseItem[]> {
  if (!isSupabaseTextbookEnabled()) {
    return getGoogleSheetsFallbackUnits(academyId, bookcode);
  }

  try {
    const accessibleCodes = await getAccessibleBookcodes(academyId);
    if (!accessibleCodes.has(bookcode)) {
      // 권한이 없거나 없는 교재인 경우 빈 배열 반환
      return [];
    }

    const { data: units, error } = await supabaseAdmin
      .from('ams_textbook_units')
      .select('unit_name, start_page, end_page')
      .eq('bookcode', bookcode)
      .order('unit_order', { ascending: true });

    if (error) throw error;

    return (units || []).map(u => ({
      unit: u.unit_name,
      start_page: String(u.start_page),
      end_page: String(u.end_page),
    }));
  } catch (err) {
    console.error(`❌ Supabase 교재 단원(${bookcode}) 조회 실패 -> 구글 시트 폴백 시도:`, err);
    return getGoogleSheetsFallbackUnits(academyId, bookcode);
  }
}

/**
 * 💡 숙제 입력기용 전체 단원(unit-page) 조회
 */
export async function getVisibleAllTextbookUnits(academyId: string): Promise<UnitResponseItem[]> {
  if (!isSupabaseTextbookEnabled()) {
    return getGoogleSheetsFallbackAllUnits(academyId);
  }

  try {
    const accessibleCodes = await getAccessibleBookcodes(academyId);
    if (accessibleCodes.size === 0) return [];

    const { data: units, error } = await supabaseAdmin
      .from('ams_textbook_units')
      .select('bookcode, unit_name, start_page, end_page')
      .in('bookcode', Array.from(accessibleCodes))
      .order('bookcode', { ascending: true })
      .order('unit_order', { ascending: true })
      .range(0, 1999);

    if (error) throw error;

    return (units || []).map(u => ({
      bookcode: u.bookcode,
      unit: u.unit_name,
      start_page: String(u.start_page),
      end_page: String(u.end_page),
    }));
  } catch (err) {
    console.error('❌ Supabase 전체 단원 조회 실패 -> 구글 시트 폴백 시도:', err);
    return getGoogleSheetsFallbackAllUnits(academyId);
  }
}

/**
 * 💡 구글 시트 마스터 폴백 (학원 격리 필터 적용)
 */
async function getGoogleSheetsFallbackMaster(academyId: string): Promise<TextbookMaster[]> {
  const allList = await fetchTextbookMasterList();
  if (academyId === HOKMA_ACADEMY_ID) {
    return allList;
  }
  // 타 학원에는 공용(common--) 교재만 제한 반환
  return allList.filter(item => item.bookcode.startsWith('common--') || item.bookcode.startsWith('common-'));
}

/**
 * 💡 구글 시트 단건 단원 폴백 (학원 격리 필터 적용)
 */
async function getGoogleSheetsFallbackUnits(academyId: string, bookcode: string): Promise<UnitResponseItem[]> {
  const isCommon = bookcode.startsWith('common--') || bookcode.startsWith('common-');
  if (academyId !== HOKMA_ACADEMY_ID && !isCommon) {
    return [];
  }
  const units = await fetchTextbookUnits(bookcode);
  return units.map(u => ({
    unit: u.unit,
    start_page: String(u.start_page),
    end_page: String(u.end_page),
  }));
}

/**
 * 💡 구글 시트 전체 단원 폴백 (학원 격리 필터 적용)
 */
async function getGoogleSheetsFallbackAllUnits(academyId: string): Promise<UnitResponseItem[]> {
  const allUnits = await fetchAllTextbookUnits();
  if (academyId === HOKMA_ACADEMY_ID) {
    return allUnits.map(u => ({
      bookcode: u.bookcode,
      unit: u.unit,
      start_page: String(u.start_page),
      end_page: String(u.end_page),
    }));
  }
  return allUnits
    .filter(u => u.bookcode.startsWith('common--') || u.bookcode.startsWith('common-'))
    .map(u => ({
      bookcode: u.bookcode,
      unit: u.unit,
      start_page: String(u.start_page),
      end_page: String(u.end_page),
    }));
}
