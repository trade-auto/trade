import React from 'react';
import { MASettings } from '../components/CandlestickChartTypes';
import useUpbitStore from '../store/useUpbitStore';

interface ChartSettingsProps {
  showMA: MASettings;
  updateShowMA: (newShowMA: MASettings) => void;
  chartHeight: number;
  handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
          <div className="text-white text-sm mb-2 font-bold">이동평균선 설정</div>
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <div className="grid grid-cols-2 gap-2">
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
                    id="onetwenty-ma"
                    className="mr-2 h-4 w-4"
                    checked={showMA.oneTwenty}
                    onChange={() => updateShowMA({ ...showMA, oneTwenty: !showMA.oneTwenty })}
                  />
                  <label htmlFor="onetwenty-ma" className="text-sm text-white">120 EMA</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="twoforty-ma"
                    className="mr-2 h-4 w-4"
                    checked={showMA.twoForty}
                    onChange={() => updateShowMA({ ...showMA, twoForty: !showMA.twoForty })}
                  />
                  <label htmlFor="twoforty-ma" className="text-sm text-white">240 EMA</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="threesixty-ma"
                    className="mr-2 h-4 w-4"
                    checked={showMA.threeHundredSixty}
                    onChange={() => updateShowMA({ ...showMA, threeHundredSixty: !showMA.threeHundredSixty })}
                  />
                  <label htmlFor="threesixty-ma" className="text-sm text-white">360 EMA</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sixhundred-ma"
                    className="mr-2 h-4 w-4"
                    checked={showMA.sixHundred}
                    onChange={() => updateShowMA({ ...showMA, sixHundred: !showMA.sixHundred })}
                  />
                  <label htmlFor="sixhundred-ma" className="text-sm text-white">600 EMA</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ninehundred-ma"
                    className="mr-2 h-4 w-4"
                    checked={showMA.nineHundred}
                    onChange={() => updateShowMA({ ...showMA, nineHundred: !showMA.nineHundred })}
                  />
                  <label htmlFor="ninehundred-ma" className="text-sm text-white">900 EMA</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 차트 높이 조절 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white text-sm mb-2 font-bold">차트 높이 조절</div>
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

      {/* 차트 시간 단위 선택 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white text-sm mb-2 font-bold">차트 시간 단위</div>
        <div className="flex flex-wrap gap-2">
          {CHART_INTERVALS.map((interval) => (
            <button
              key={interval.value}
              onClick={() => onChartTypeChange(interval.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-150 ${
                chartType === interval.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChartSettings; 