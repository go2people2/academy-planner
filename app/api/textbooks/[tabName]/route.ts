import { NextRequest, NextResponse } from 'next/server';
import { authenticateTextbookRequest } from '@/lib/textbookAuth';
import { getVisibleTextbookUnits, getVisibleAllTextbookUnits } from '@/lib/textbookService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tabName: string }> }
) {
  try {
    // 1. 요청자 인증 및 소속 학원 확인 (미인증 시 401)
    const auth = await authenticateTextbookRequest(req);
    if (!auth.success || !auth.academyId) {
      return NextResponse.json(
        { error: auth.error || '인증되지 않은 요청입니다.' },
        { status: auth.status || 401 }
      );
    }

    const resolvedParams = await params;
    const tabName = resolvedParams.tabName;

    // 2. 전체 단원(unit-page) 요청인 경우 동일한 학원 권한 필터 적용
    if (tabName === 'unit-page') {
      const allUnits = await getVisibleAllTextbookUnits(auth.academyId);
      return NextResponse.json(allUnits);
    }

    // 3. 특정 교재 코드 단원 요청
    const units = await getVisibleTextbookUnits(auth.academyId, tabName);
    return NextResponse.json(units);
  } catch (error) {
    console.error('API Route Error in [tabName]:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
