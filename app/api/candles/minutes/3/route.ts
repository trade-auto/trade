import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  const count = searchParams.get('count') || '3';
  
  if (!market) {
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.upbit.com/v1/candles/minutes/30?market=${market}&count=${count}`
    );
    
    if (!response.ok) {
      throw new Error('업비트 API 요청 실패');
    }

    const data = await response.json();
    
    // 시간 순서대로 정렬 (오름차순)
    // 업비트 API는 최신 데이터가 먼저 오는 내림차순으로 데이터를 반환함
    data.sort((a: any, b: any) => {
      const timeA = new Date(a.candle_date_time_kst).getTime();
      const timeB = new Date(b.candle_date_time_kst).getTime();
      return timeA - timeB;
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '캔들 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 