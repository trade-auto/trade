import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  
  if (!market) {
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
    
    if (!response.ok) {
      throw new Error('업비트 API 요청 실패');
    }

    const data = await response.json();
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '현재가 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 