import React from 'react';
import { TradeStrategy } from './types';

interface StrategySelectorProps {
  tradeStrategy: TradeStrategy;
  handleStrategyChange: (strategy: TradeStrategy) => void;
  disabled: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({ 
  tradeStrategy, 
  handleStrategyChange, 
  disabled 
}) => {
  return (
    <div className="flex flex-col gap-2 bg-gray-700 p-4 rounded-lg">
      <h3 className="text-white font-bold mb-2">매매 전략 선택</h3>
      <div className="grid grid-cols-1 gap-2">
        <StrategyOption
          strategy="BOLLINGER"
          currentStrategy={tradeStrategy}
          onChange={handleStrategyChange}
          disabled={disabled}
          title="볼린저 밴드 전략"
          description="20일 기준, 2 표준편차 상/하단 돌파 시 매매"
        />

        <StrategyOption
          strategy="MA_CROSS"
          currentStrategy={tradeStrategy}
          onChange={handleStrategyChange}
          disabled={disabled}
          title="이동평균선 교차 전략"
          description="30MA/40MA, 40MA/60MA 교차 시 매매"
        />

        <StrategyOption
          strategy="MA_CROSS_DEVIATION"
          currentStrategy={tradeStrategy}
          onChange={handleStrategyChange}
          disabled={disabled}
          title="이격도 MA 교차 전략"
          description="60MA/120MA 이격도 2% 이상 시 매매"
        />

        <StrategyOption
          strategy="SLOPE_FILTER"
          currentStrategy={tradeStrategy}
          onChange={handleStrategyChange}
          disabled={disabled}
          title="기울기 필터 전략"
          description="RSI, MACD, MA 기울기 복합 분석"
        />
      </div>
    </div>
  );
};

interface StrategyOptionProps {
  strategy: TradeStrategy;
  currentStrategy: TradeStrategy;
  onChange: (strategy: TradeStrategy) => void;
  disabled: boolean;
  title: string;
  description: string;
}

const StrategyOption: React.FC<StrategyOptionProps> = ({
  strategy,
  currentStrategy,
  onChange,
  disabled,
  title,
  description
}) => {
  return (
    <label className={`flex items-center p-3 rounded cursor-pointer ${
      disabled ? 'opacity-50 cursor-not-allowed' : 
      currentStrategy === strategy 
        ? 'bg-blue-600 ring-2 ring-white' 
        : 'bg-gray-600 hover:bg-gray-700'
    }`}>
      <input
        type="radio"
        name="tradeStrategy"
        value={strategy}
        checked={currentStrategy === strategy}
        onChange={() => onChange(strategy)}
        disabled={disabled}
        className="hidden"
      />
      <div className="flex flex-col">
        <span className="text-white font-medium">{title}</span>
        <span className="text-gray-300 text-sm">{description}</span>
      </div>
    </label>
  );
};

export default StrategySelector; 