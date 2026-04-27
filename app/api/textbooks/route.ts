import { NextResponse } from 'next/server';
import { fetchTextbookMasterList } from '@/lib/googleSheets';

export async function GET() {
  try {
    const textbooks = await fetchTextbookMasterList();
    return NextResponse.json(textbooks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch textbooks' }, { status: 500 });
  }
}
