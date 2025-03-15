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
      `https://api.upbit.com/v1/trades/ticks?market=${market}&count=${count}`
    );
    
    if (!response.ok) {
      throw new Error('업비트 API 요청 실패');
    }

    const data = await response.json();
    
    // 디버깅을 위한 로그 추가
    console.log('Raw trade prices:', data.map((trade: any) => trade.trade_price));
    const sortedPrices = data
      .map((trade: any) => Number(trade.trade_price))
      .sort((a: number, b: number) => a - b);
    console.log('Sorted prices:', sortedPrices);
    console.log('Selected median:', sortedPrices[1]);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '체결 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

