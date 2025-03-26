import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Coin {
  symbol: string;
  name: string;
}

export const AVAILABLE_COINS: Coin[] = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-SOL', name: '솔라나' },
  { symbol: 'KRW-ADA', name: '에이다' },
  { symbol: 'KRW-AVAX', name: '아발란체' },
  { symbol: 'KRW-DOT', name: '폴카닷' },
  { symbol: 'KRW-MATIC', name: '폴리곤' },
  { symbol: 'KRW-DOGE', name: '도지코인' },
  { symbol: 'KRW-SHIB', name: '시바이누' },
  { symbol: 'KRW-LINK', name: '체인링크' },
  { symbol: 'KRW-ATOM', name: '코스모스' },
  { symbol: 'KRW-MOVE', name: '무브먼트' },
  { symbol: 'KRW-LAYER', name: '솔레이어' },
  { symbol: 'KRW-MEW', name: '캣인어독스월드' },
  { symbol: 'KRW-AUCTION', name: '바운스토큰' },
  { symbol: 'KRW-CRO', name: '크로노스' },
  { symbol: 'KRW-ZETA', name: '제타체인' },
  { symbol: 'KRW-CARV', name: '카브' },
  { symbol: 'KRW-USDT', name: '테더' },
  { symbol: 'KRW-SONIC', name: '소닉SVM' },
  { symbol: 'KRW-ONDO', name: '온도파이낸스' },
  { symbol: 'KRW-TRUMP', name: '오피셜트럼프' },
  { symbol: 'KRW-PEPE', name: '페페' },
  { symbol: 'KRW-MOCA', name: '모카네트워크' },
  { symbol: 'KRW-IMX', name: '이뮤터블엑스' },
  { symbol: 'KRW-AGLD', name: '어드벤처골드' },
  { symbol: 'KRW-SUI', name: '수이' },
  { symbol: 'KRW-BEAM', name: '빔' },
  { symbol: 'KRW-VANA', name: '바나' },
  { symbol: 'KRW-W', name: '웜홀' },
  { symbol: 'KRW-BERA', name: '베라체인' },
  { symbol: 'KRW-BONK', name: '봉크' },
  { symbol: 'KRW-STX', name: '스택스' }
];

interface CoinStore {
  selectedCoin: string;
  setSelectedCoin: (symbol: string) => void;
}

export const useCoinStore = create<CoinStore>()(
  persist(
    (set) => ({
      selectedCoin: AVAILABLE_COINS[0].symbol,
      setSelectedCoin: (symbol) => set({ selectedCoin: symbol }),
    }),
    { name: 'coin-store' }
  )
); 