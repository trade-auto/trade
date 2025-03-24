import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  const count = searchParams.get('count') || '3';
  
  if (!market) {
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    // 업비트 API에서는 초봉 API가 없어서 1분봉을 가져옴
    const response = await fetch(
      `https://api.upbit.com/v1/candles/minutes/1?market=${market}&count=${count}`
    );
    
    if (!response.ok) {
      throw new Error('업비트 API 요청 실패');
    }

    const minuteData = await response.json();
    
    // 1분봉 데이터를 초봉 형태로 변환
    // 현재 시간을 기준으로 마지막 캔들의 시간을 조정
    const secondsData = minuteData.map(candle => {
      // 캔들 시간 파싱
      const candleTime = new Date(candle.candle_date_time_kst);
      
      // 현재 시간과의 차이를 계산해 시간 조정 (최근 데이터일수록 더 정확한 시간)
      const now = new Date();
      const secondsAgo = Math.floor((now.getTime() - candleTime.getTime()) / 1000);
      
      // 60초(1분)보다 적게 지났으면 실시간 초봉으로 처리
      if (secondsAgo < 60) {
        // 현재 시간의 초 단위를 구함
        const currentSeconds = now.getSeconds();
        // 가장 최근 60초 캔들의 시작 시간 계산 (현재 시간에서 초만 0으로 맞춤)
        const latestCandleTime = new Date(now);
        latestCandleTime.setSeconds(0, 0);
        
        return {
          ...candle,
          candle_date_time_utc: latestCandleTime.toISOString(),
          candle_date_time_kst: latestCandleTime.toLocaleString('ko-KR'),
          unit: 60 // 60초 단위로 변경
        };
      }
      
      // 1분 이상 지난 데이터는 그대로 반환
      return {
        ...candle,
        unit: 60 // 60초 단위로 표시
      };
    });
    
    return NextResponse.json(secondsData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '캔들 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 