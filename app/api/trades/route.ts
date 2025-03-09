import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  const count = searchParams.get('count') || '3';
  
  if (!market) {
    console.log('마켓 코드가 제공되지 않았습니다.');
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  console.log(`체결 내역 조회 요청: ${market}, count: ${count}`);

  try {
    // 업비트 API 호출
    const apiUrl = `https://api.upbit.com/v1/trades/ticks?market=${market}&count=${count}`;
    console.log(`업비트 API 호출: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    // 응답 상태 확인
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`업비트 API 응답 오류: ${response.status} ${response.statusText}`);
      console.error(`응답 내용: ${errorText}`);
      throw new Error(`업비트 API 요청 실패: ${response.status} ${response.statusText}`);
    }

    // 응답 데이터 파싱
    const data = await response.json();
    
    // 데이터 확인
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('업비트 API에서 유효한 데이터를 반환하지 않았습니다:', data);
      throw new Error('유효한 데이터를 받지 못했습니다.');
    }
    
    // 디버깅을 위한 로그 추가
    console.log('체결 내역 조회 성공:', market);
    console.log('Raw trade prices:', data.map((trade: any) => trade.trade_price));
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('체결 내역 조회 중 오류 발생:', error);
    return NextResponse.json(
      { error: error.message || '체결 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

