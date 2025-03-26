import React from 'react';
import { useCoinStore, AVAILABLE_COINS } from '../store/useCoinStore';

export const CoinSelector: React.FC = () => {
  const { selectedCoin, setSelectedCoin } = useCoinStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCoin(e.target.value);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        코인 선택
      </label>
      <select
        value={selectedCoin}
        onChange={handleChange}
        className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {AVAILABLE_COINS.map(({ symbol, name }) => (
          <option key={symbol} value={symbol}>
            {name} ({symbol.replace('KRW-', '')})
          </option>
        ))}
      </select>
    </div>
  );
}; 