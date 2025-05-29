import React from 'react';
import { useCoinStore } from '../store/useCoinStore';

export const AVAILABLE_COINS = [
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-MOVE', name: '무브먼트' },
  { symbol: 'KRW-LAYER', name: '솔레이어' },
  { symbol: 'KRW-DOGE', name: '도지코인' },
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-MEW', name: '캣인어독스월드' },
  { symbol: 'KRW-AUCTION', name: '바운스토큰' },
  { symbol: 'KRW-SHIB', name: '시바이누' },
  { symbol: 'KRW-SOL', name: '솔라나' },
  { symbol: 'KRW-CRO', name: '크로노스' },
  { symbol: 'KRW-ZETA', name: '제타체인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-CARV', name: '카브' },
  { symbol: 'KRW-USDT', name: '테더' },
  { symbol: 'KRW-ADA', name: '에이다' },
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

export const CoinSelector: React.FC = () => {
  const { selectedCoin, setSelectedCoin } = useCoinStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCoin(e.target.value);
  };

  return (
    <div className="flex items-center justify-center my-4 px-4">
      <div className="w-64">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          코인 선택
        </label>
        <div className="relative">
          <select
            value={selectedCoin}
            onChange={handleChange}
            className="block w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 appearance-none cursor-pointer
                     border border-gray-600 hover:border-blue-500 transition-colors duration-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {AVAILABLE_COINS.map(({ symbol, name }) => (
              <option key={symbol} value={symbol}>
                {name} ({symbol.replace('KRW-', '')})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}; 