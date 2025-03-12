import React from 'react';
import { MASettings } from '../types/candlestick';
import useUpbitStore from '../store/useUpbitStore';

interface ChartSettingsProps {
  showMA: MASettings;
  updateShowMA: (newShowMA: MASettings) => void;
  chartHeight: number;
  handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ChartSettings: React.FC<ChartSettingsProps> = ({
  showMA,
  updateShowMA,
  chartHeight,
  handleHeightChange
}) => {
  // 스토어에서 5번째 조건 상태와 토글 함수 가져오기
  const { useFifthCondition, toggleFifthCondition } = useUpbitStore();
  
  // MA 토글 함수
  const toggleMA = (key: keyof MASettings) => {
    const updatedShowMA = { ...showMA };
    updatedShowMA[key] = !updatedShowMA[key];
    updateShowMA(updatedShowMA);
  };

  return (
    <div className="mb-4 space-y-4">
      {/* 전략 설정 패널 */}
      <div className="grid grid-cols-1 gap-4 bg-gray-800 p-4 rounded-lg">
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">전략 설정</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleFifthCondition}
              className={`px-3 py-1 rounded text-sm ${useFifthCondition ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {useFifthCondition ? '5번째 조건 활성화됨' : '5번째 조건 비활성화됨'}
            </button>
            <div className="text-xs text-gray-400 mt-1">
              5번째 조건: MA60 &lt; MA600 {useFifthCondition ? '(필수)' : '(무시됨)'}
            </div>
          </div>
        </div>
      </div>
      
      {/* MA 설정 패널 */}
      <div className="grid grid-cols-1 gap-4 bg-gray-800 p-4 rounded-lg">
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 설정</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => toggleMA('sixty')}
              className={`px-2 py-1 rounded ${showMA.sixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.sixty ? '✓ 60MA 보기' : '60MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('oneTwenty')}
              className={`px-2 py-1 rounded ${showMA.oneTwenty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.oneTwenty ? '✓ 120MA 보기' : '120MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('twoForty')}
              className={`px-2 py-1 rounded ${showMA.twoForty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.twoForty ? '✓ 240MA 보기' : '240MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('threeHundredSixty')}
              className={`px-2 py-1 rounded ${showMA.threeHundredSixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.threeHundredSixty ? '✓ 360MA 보기' : '360MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('sixHundred')}
              className={`px-2 py-1 rounded ${showMA.sixHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.sixHundred ? '✓ 600MA 보기' : '600MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('nineHundred')}
              className={`px-2 py-1 rounded ${showMA.nineHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.nineHundred ? '✓ 900MA 보기' : '900MA 숨김'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 차트 높이 조절 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">차트 높이 조절</div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="300"
            max="800"
            step="50"
            value={chartHeight}
            onChange={handleHeightChange}
            className="flex-1"
          />
          <div className="text-white font-bold w-20 text-center">{chartHeight}px</div>
        </div>
      </div>
    </div>
  );
};

export default ChartSettings; 