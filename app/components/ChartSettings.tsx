import React from 'react';
import { MASettings } from '../types/candlestick';

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
  // MA 토글 함수
  const toggleMA = (key: keyof MASettings) => {
    const updatedShowMA = { ...showMA };
    updatedShowMA[key] = !updatedShowMA[key];
    updateShowMA(updatedShowMA);
  };

  return (
    <div className="mb-4 space-y-4">
      {/* MA 설정 패널 */}
      <div className="grid grid-cols-3 gap-4 bg-gray-800 p-4 rounded-lg">
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
              onClick={() => toggleMA('threeHundred')}
              className={`px-2 py-1 rounded ${showMA.threeHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.threeHundred ? '✓ 300MA 보기' : '300MA 숨김'}
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