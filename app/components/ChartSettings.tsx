import React from 'react';
import { MASettings } from '../components/CandlestickChartTypes';
import useUpbitStore from '../store/useUpbitStore';

interface ChartSettingsProps {
  showMA: MASettings;
  updateShowMA: (newShowMA: MASettings) => void;
  chartHeight: number;
  handleHeightChange: (height: number) => void;
  chartType: string;
  onChartTypeChange: (type: string) => void;
}

const ChartSettings: React.FC<ChartSettingsProps> = ({
  showMA,
  updateShowMA,
  chartHeight,
  handleHeightChange,
  chartType,
  onChartTypeChange
}) => {
  // 스토어에서 5번째 조건 상태와 토글 함수 가져오기
  const { useFifthCondition, toggleFifthCondition } = useUpbitStore();
  
  // MA 토글 함수
  const toggleMA = (key: keyof MASettings) => {
    const updatedShowMA = { ...showMA };
    updatedShowMA[key] = !updatedShowMA[key];
    updateShowMA(updatedShowMA);
  };

  // 차트 인터벌 정의
  const CHART_INTERVALS = [
    { value: 'seconds/60', label: '초봉' },
    { value: 'minutes/5', label: '5분봉' },
    { value: 'minutes/15', label: '15분봉' },
  ];

  return (
    <div className="bg-gray-800 p-4 rounded-lg mt-32">
      <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">차트 설정</h3>
      
      {/* 전략 설정 패널 */}
      <div className="grid grid-cols-1 gap-4 bg-gray-800 p-4 rounded-lg">
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-300 text-sm font-medium mb-2">전략 설정</div>
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
      
      {/* 이동평균선 설정 */}
      <div className="mt-8 mb-8">
        <h4 className="text-sm font-medium text-gray-300 mb-3">이동평균선</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="five-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.five}
              onChange={() => updateShowMA({ ...showMA, five: !showMA.five })}
            />
            <label htmlFor="five-ma" className="text-sm text-white">5 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="ten-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.ten}
              onChange={() => updateShowMA({ ...showMA, ten: !showMA.ten })}
            />
            <label htmlFor="ten-ma" className="text-sm text-white">10 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="twenty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.twenty}
              onChange={() => updateShowMA({ ...showMA, twenty: !showMA.twenty })}
            />
            <label htmlFor="twenty-ma" className="text-sm text-white">20 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="thirty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.thirty}
              onChange={() => updateShowMA({ ...showMA, thirty: !showMA.thirty })}
            />
            <label htmlFor="thirty-ma" className="text-sm text-white">30 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="sixty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.sixty}
              onChange={() => updateShowMA({ ...showMA, sixty: !showMA.sixty })}
            />
            <label htmlFor="sixty-ma" className="text-sm text-white">60 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="one-twenty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.oneTwenty}
              onChange={() => updateShowMA({ ...showMA, oneTwenty: !showMA.oneTwenty })}
            />
            <label htmlFor="one-twenty-ma" className="text-sm text-white">120 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="two-forty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.twoForty}
              onChange={() => updateShowMA({ ...showMA, twoForty: !showMA.twoForty })}
            />
            <label htmlFor="two-forty-ma" className="text-sm text-white">240 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="three-sixty-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.threeHundredSixty}
              onChange={() => updateShowMA({ ...showMA, threeHundredSixty: !showMA.threeHundredSixty })}
            />
            <label htmlFor="three-sixty-ma" className="text-sm text-white">360 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="six-hundred-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.sixHundred}
              onChange={() => updateShowMA({ ...showMA, sixHundred: !showMA.sixHundred })}
            />
            <label htmlFor="six-hundred-ma" className="text-sm text-white">600 EMA</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="nine-hundred-ma"
              className="mr-2 h-4 w-4"
              checked={showMA.nineHundred}
              onChange={() => updateShowMA({ ...showMA, nineHundred: !showMA.nineHundred })}
            />
            <label htmlFor="nine-hundred-ma" className="text-sm text-white">900 EMA</label>
          </div>
        </div>
      </div>

      {/* 차트 높이 설정 */}
      <div className="mb-8">
        <h4 className="text-sm font-medium text-gray-300 mb-3">차트 높이</h4>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="200"
            max="800"
            value={chartHeight}
            onChange={(e) => handleHeightChange(parseInt(e.target.value))}
            className="w-full"
          />
          <span className="text-sm text-white">{chartHeight}px</span>
        </div>
      </div>

      {/* 차트 타입 설정 */}
      <div className="mb-8">
        <h4 className="text-sm font-medium text-gray-300 mb-3">차트 타입</h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onChartTypeChange('minutes/5')}
            className={`px-3 py-1 rounded text-sm ${
              chartType === 'minutes/5'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            5분봉
          </button>
          <button
            onClick={() => onChartTypeChange('minutes/15')}
            className={`px-3 py-1 rounded text-sm ${
              chartType === 'minutes/15'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            15분봉
          </button>
          <button
            onClick={() => onChartTypeChange('seconds/60')}
            className={`px-3 py-1 rounded text-sm ${
              chartType === 'seconds/60'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1분봉
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartSettings; 