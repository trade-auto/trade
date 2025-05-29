import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Coin {
  symbol: string;
  name: string;
}

export const AVAILABLE_COINS: Coin[] = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' }
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