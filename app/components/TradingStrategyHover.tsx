import React from 'react';
import { TradeStrategy } from '../strategies/types';

interface TradingStrategyHoverProps {
  tradeStrategy: TradeStrategy;
  updateTradeStrategy: (strategy: TradeStrategy) => void;
}

const TradingStrategyHover: React.FC<TradingStrategyHoverProps> = ({
  tradeStrategy,
  updateTradeStrategy,
}) => {
  return (
    <div className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50">
      <div className="bg-gray-800 text-white p-4 rounded-r-lg shadow-lg border-r-4 border-blue-500 hover:translate-x-0 transition-transform duration-300 ease-in-out" 
           style={{ transform: 'translateX(-5%)', width: '200px' }}>
        <h3 className="text-lg font-bold mb-4">매매 전략</h3>
        <div className="space-y-2">
          {(['BOLLINGER', 'MA_CROSS', 'MA_CROSS_DEVIATION', 'SLOPE_FILTER'] as TradeStrategy[]).map((strategy) => (
            <button
              key={strategy}
              onClick={() => updateTradeStrategy(strategy)}
              className={`w-full px-4 py-2 rounded ${
                tradeStrategy === strategy
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {strategy === 'BOLLINGER' && '볼린저 밴드'}
              {strategy === 'MA_CROSS' && 'MA 크로스'}
              {strategy === 'MA_CROSS_DEVIATION' && 'MA 이탈'}
              {strategy === 'SLOPE_FILTER' && '기울기필터4전략'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TradingStrategyHover;