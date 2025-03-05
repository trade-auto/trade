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
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="text-white text-lg font-bold mb-4">설정</div>
      
      {/* MA 설정 */}
      <div className="mb-4">
        <div className="text-white mb-2">이동 평균선</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => toggleMA('sixty')}
            className={`px-3 py-2 rounded-md text-sm ${
              showMA.sixty ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'
            }`}
          >
            60MA
          </button>
          <button
            onClick={() => toggleMA('oneTwenty')}
            className={`px-3 py-2 rounded-md text-sm ${
              showMA.oneTwenty ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'
            }`}
          >
            120MA
          </button>
          <button
            onClick={() => toggleMA('twoForty')}
            className={`px-3 py-2 rounded-md text-sm ${
              showMA.twoForty ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-300'
            }`}
          >
            240MA
          </button>
          <button
            onClick={() => toggleMA('threeHundredSixty')}
            className={`px-3 py-2 rounded-md text-sm ${
              showMA.threeHundredSixty ? 'bg-gray-900 text-white' : 'bg-gray-600 text-gray-300'
            }`}
          >
            360MA
          </button>
        </div>
      </div>
      
      {/* 높이 설정 */}
      <div>
        <div className="text-white mb-2">차트 높이 설정: {chartHeight}px</div>
        <input
          type="range"
          min="300"
          max="800"
          step="50"
          value={chartHeight}
          onChange={handleHeightChange}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default ChartSettings; 