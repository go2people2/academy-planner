import { NextResponse } from 'next/server';
import { fetchTextbookUnits, fetchAllTextbookUnits } from '@/lib/googleSheets';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tabName: string }> } // params를 Promise로 정의
) {
  try {
    // Next.js 15 규칙에 따라 params를 await로 풀어줍니다.
    const resolvedParams = await params;
    const tabName = resolvedParams.tabName;
    
    // 💡 "unit-page" 요청 시 전체 단원 정보 반환 (에디터용)
    if (tabName === 'unit-page') {
      const allUnits = await fetchAllTextbookUnits();
      return NextResponse.json(allUnits);
    }
    
    // 특정 교재 코드 요청 시 해당 교재의 단원만 반환
    const units = await fetchTextbookUnits(tabName);
    return NextResponse.json(units);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
