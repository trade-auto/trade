import React from 'react';
import { useCoinStore, AVAILABLE_COINS } from '../store/useCoinStore';

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