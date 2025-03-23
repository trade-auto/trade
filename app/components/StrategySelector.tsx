'use client';

import React from 'react';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';

interface StrategySelectorProps {
  tradeStrategy?: TradeStrategy;
  handleStrategyChange?: (strategy: TradeStrategy) => void;
  disabled?: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({ 
  tradeStrategy: propTradeStrategy, 
  handleStrategyChange, 
  disabled = false 
}) => {
  const { tradeStrategy: storeTradeStrategy, updateTradeStrategy } = useUpbitStore();
  
  // props에서 가져온 값 또는 store에서 가져온 값 사용
  const currentStrategy = propTradeStrategy || storeTradeStrategy;
  
  // 전략 변경 핸들러
  const onStrategyChange = (strategy: TradeStrategy) => {
    // props의 핸들러가 있으면 props의 핸들러 호출
    if (handleStrategyChange) {
      handleStrategyChange(strategy);
    } else {
      // 없으면 store의 업데이트 함수 호출
      updateTradeStrategy(strategy);
    }
  };

  const strategies = [
    { id: 'MA_CROSS', label: 'MA 크로스' },
    { id: 'MA_CROSS_DEVIATION', label: 'MA 이탈' },
    { id: 'MACD', label: 'MACD전략' },
    { id: 'SLOPE_FILTER', label: '기울기필터4전략' },
  ];

  return (
    <div className="p-4 bg-gray-800 rounded-lg mb-6">
      <h3 className="text-xl font-bold text-white mb-4">매매 전략 선택</h3>
      <div className="grid grid-cols-2 gap-3">
        {strategies.map((strategy) => (
          <label
            key={strategy.id}
            className={`relative p-4 rounded-lg flex items-center space-x-2 cursor-pointer transition ${
              disabled ? 'opacity-60 cursor-not-allowed ' : ''
            }${
              currentStrategy === strategy.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <input
              type="radio"
              name="strategy"
              value={strategy.id}
              checked={currentStrategy === strategy.id}
              onChange={() => !disabled && onStrategyChange(strategy.id as TradeStrategy)}
              disabled={disabled}
              className="opacity-0 absolute"
            />
            <span className={`w-4 h-4 border-2 rounded-full flex-shrink-0 ${
              currentStrategy === strategy.id 
                ? 'border-white bg-white' 
                : 'border-gray-400'
            }`}>
              {currentStrategy === strategy.id && (
                <span className="block w-2 h-2 mt-0.5 ml-0.5 rounded-full bg-blue-600"></span>
              )}
            </span>
            <span>{strategy.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default StrategySelector;
