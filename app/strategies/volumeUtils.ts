import axios from 'axios';

// 매수/매도 거래량 데이터 인터페이스
export interface VolumeData {
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  buySellRatio: number; // 매수/매도 비율
}

// 거래량 데이터 캐시 (API 호출 최소화)
const volumeCache: Record<string, { data: VolumeData, timestamp: number }> = {};

// 현재 캐시된 거래량 데이터 가져오기 (동기 함수)
export function getCachedVolumeData(market: string = 'KRW-BTC'): VolumeData {
  const cacheKey = `${market}_100`;
  if (volumeCache[cacheKey]) {
    return volumeCache[cacheKey].data;
  }
  return { buyVolume: 0, sellVolume: 0, totalVolume: 0, buySellRatio: 0 };
}

/**
 * 업비트 API를 통해 매수/매도 거래량 데이터 조회
 * - 체결 내역 API를 사용하여 최근 거래의 매수/매도 구분
 * - 캐시 기능 포함 (1분 이내 반복 호출 시 캐시 데이터 반환)
 */
export async function getTradeVolume(market: string, count: number = 100): Promise<VolumeData> {
  // 1분(60초) 이내 캐시된 데이터가 있으면 재사용
  const now = Date.now();
  const cacheKey = `${market}_${count}`;
  if (volumeCache[cacheKey] && now - volumeCache[cacheKey].timestamp < 60000) {
    console.log('캐시된 거래량 데이터 사용');
    return volumeCache[cacheKey].data;
  }

  try {
    const url = `https://api.upbit.com/v1/trades/ticks?market=${market}&count=${count}`;
    const response = await axios.get(url);
    const trades = response.data;

    let buyVolume = 0;
    let sellVolume = 0;

    trades.forEach((trade: any) => {
      const volume = parseFloat(trade.trade_volume);
      if (trade.ask_bid === 'BID') {
        buyVolume += volume;
      } else if (trade.ask_bid === 'ASK') {
        sellVolume += volume;
      }
    });

    const totalVolume = buyVolume + sellVolume;
    const buySellRatio = sellVolume > 0 ? buyVolume / sellVolume : 0;

    console.log(`[거래량 분석] 매수: ${buyVolume.toFixed(4)}, 매도: ${sellVolume.toFixed(4)}, 비율: ${buySellRatio.toFixed(2)}`);

    // 결과 캐싱
    const result = { buyVolume, sellVolume, totalVolume, buySellRatio };
    volumeCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error('거래량 데이터 조회 실패:', error);
    // 오류 발생 시 기본값 반환
    return { buyVolume: 0, sellVolume: 0, totalVolume: 0, buySellRatio: 0 };
  }
}

/**
 * 매수 신호 확인
 * 매수 거래량이 매도 거래량보다 20% 이상 많은 경우
 */
export function hasBuySignal(buyVolume: number, sellVolume: number): boolean {
  return sellVolume > 0 && buyVolume / sellVolume >= 1.2;
}

/**
 * 매도 신호 확인
 * 매수 거래량이 매도 거래량보다 20% 이상 적은 경우
 */
export function hasSellSignal(buyVolume: number, sellVolume: number): boolean {
  return sellVolume > 0 && buyVolume / sellVolume <= 0.8;
}
