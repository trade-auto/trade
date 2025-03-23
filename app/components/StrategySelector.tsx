'use client';

import { TradeStrategy } from '../types/trading';

interface StrategySelectorProps {
  tradeStrategy: TradeStrategy;
  handleStrategyChange: (strategy: TradeStrategy) => void;
  disabled: boolean;
}

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  tradeStrategy,
  handleStrategyChange,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-2 bg-gray-700 p-4 rounded-lg">
      <h3 className="text-white font-bold mb-2">매매 전략 선택</h3>
      <div className="grid grid-cols-1 gap-2">
        <label className={`flex items-center p-3 rounded cursor-pointer ${
          tradeStrategy === 'BOLLINGER' 
            ? 'bg-blue-600 ring-2 ring-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}>
          <input
            type="radio"
            name="tradeStrategy"
            value="BOLLINGER"
            checked={tradeStrategy === 'BOLLINGER'}
            onChange={() => handleStrategyChange('BOLLINGER')}
            disabled={disabled}
            className="hidden"
          />
          <div className="flex flex-col">
            <span className="text-white font-medium">MACD 밴드 전략</span>
            <span className="text-gray-300 text-sm">20일 기준, 2 표준편차 상/하단 돌파 시 매매</span>
          </div>
        </label>

        <label className={`flex items-center p-3 rounded cursor-pointer ${
          tradeStrategy === 'MA_CROSS' 
            ? 'bg-blue-600 ring-2 ring-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}>
          <input
            type="radio"
            name="tradeStrategy"
            value="MA_CROSS"
            checked={tradeStrategy === 'MA_CROSS'}
            onChange={() => handleStrategyChange('MA_CROSS')}
            disabled={disabled}
            className="hidden"
          />
          <div className="flex flex-col">
            <span className="text-white font-medium">이동평균선 교차 전략</span>
            <span className="text-gray-300 text-sm">30MA/40MA, 40MA/60MA 교차 시 매매</span>
          </div>
        </label>

        <label className={`flex items-center p-3 rounded cursor-pointer ${
          tradeStrategy === 'MA_CROSS_DEVIATION' 
            ? 'bg-blue-600 ring-2 ring-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}>
          <input
            type="radio"
            name="tradeStrategy"
            value="MA_CROSS_DEVIATION"
            checked={tradeStrategy === 'MA_CROSS_DEVIATION'}
            onChange={() => handleStrategyChange('MA_CROSS_DEVIATION')}
            disabled={disabled}
            className="hidden"
          />
          <div className="flex flex-col">
            <span className="text-white font-medium">이격도 MA 교차 전략</span>
            <span className="text-gray-300 text-sm">60MA/120MA 이격도 2% 이상 시 매매</span>
          </div>
        </label>

        <label className={`flex items-center p-3 rounded cursor-pointer ${
          tradeStrategy === 'SLOPE_FILTER' 
            ? 'bg-blue-600 ring-2 ring-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}>
          <input
            type="radio"
            name="tradeStrategy"
            value="SLOPE_FILTER"
            checked={tradeStrategy === 'SLOPE_FILTER'}
            onChange={() => handleStrategyChange('SLOPE_FILTER')}
            disabled={disabled}
            className="hidden"
          />
          <div className="flex flex-col">
            <span className="text-white font-medium">기울기 필터 전략</span>
            <span className="text-gray-300 text-sm">RSI, MACD, MA 기울기 복합 분석</span>
          </div>
        </label>
      </div>
    </div>
  );
}; 