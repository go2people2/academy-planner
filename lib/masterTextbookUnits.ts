import { createClient } from '@supabase/supabase-js';
export { parsePastedUnits } from './unitPasteParser';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('Supabase admin credentials missing on server.');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface UnitInput {
  unit_name: string;
  start_page: number;
  end_page: number;
}

/**
 * 💡 클라이언트에서 전달된 단원 배열을 검증/정규화합니다.
 * - 단원명이 비어 있으면 오류, 시작 페이지 > 끝 페이지이면 오류(DB 제약조건과 동일)
 */
export function normalizeUnits(raw: unknown): { units?: UnitInput[]; error?: string } {
  if (raw === undefined || raw === null) return { units: undefined };
  if (!Array.isArray(raw)) return { error: '단원 목록 형식이 올바르지 않습니다.' };

  const units: UnitInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const u: any = raw[i];
    const name = String(u?.unit_name ?? '').trim();
    const start = parseInt(u?.start_page, 10) || 0;
    const end = parseInt(u?.end_page, 10) || 0;
    if (!name) return { error: `${i + 1}번째 단원의 이름이 비어 있습니다.` };
    if (start > end) return { error: `${i + 1}번째 단원('${name}')의 시작 페이지가 끝 페이지보다 큽니다.` };
    units.push({ unit_name: name, start_page: start, end_page: end });
  }
  return { units };
}

/**
 * 💡 교재의 단원 목록을 전달된 배열과 동기화합니다.
 * - (bookcode, unit_order) 기준 upsert → 기존 단원 id 보존
 * - 배열 길이보다 큰 unit_order는 삭제
 */
export async function syncBookUnits(bookcode: string, units: UnitInput[]): Promise<void> {
  const now = new Date().toISOString();

  if (units.length > 0) {
    const rows = units.map((u, idx) => ({
      bookcode,
      unit_order: idx + 1,
      unit_name: u.unit_name,
      start_page: u.start_page,
      end_page: u.end_page,
      updated_at: now,
    }));
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('ams_textbook_units')
      .upsert(rows, { onConflict: 'bookcode,unit_order' });
    if (error) throw error;
  }

  const admin = getSupabaseAdmin();
  const { error: delErr } = await admin
    .from('ams_textbook_units')
    .delete()
    .eq('bookcode', bookcode)
    .gt('unit_order', units.length);
  if (delErr) throw delErr;
}

/**
 * 💡 전체 단원의 bookcode 목록을 1000행 제한 없이 페이지 단위로 조회합니다.
 */
export async function fetchAllUnitBookcodes(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const PAGE = 1000;
  const all: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('ams_textbook_units')
      .select('bookcode')
      .order('bookcode', { ascending: true })
      .order('unit_order', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data || []) all.push(row.bookcode);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

/**
 * 💡 단일 교재의 단원 목록 조회 (편집 모달용)
 */
export async function fetchBookUnits(bookcode: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('ams_textbook_units')
    .select('unit_order, unit_name, start_page, end_page')
    .eq('bookcode', bookcode)
    .order('unit_order', { ascending: true });
  if (error) throw error;
  return data || [];
}
