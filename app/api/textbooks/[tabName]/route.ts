import { NextResponse } from 'next/server';
import { fetchTextbookUnits } from '@/lib/googleSheets';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tabName: string }> } // params를 Promise로 정의
) {
  try {
    // Next.js 15 규칙에 따라 params를 await로 풀어줍니다.
    const resolvedParams = await params;
    const bookTitle = resolvedParams.tabName; // URL 파라미터는 tabName이지만 실제로는 교재 제목
    
    const units = await fetchTextbookUnits(bookTitle);
    return NextResponse.json(units);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
