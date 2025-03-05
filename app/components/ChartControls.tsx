import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { DateRange } from '../types/candlestick';

interface ChartControlsProps {
  isAutoUpdate: boolean;
  isRealtimeAPIEnabled: boolean;
  dateRange: DateRange;
  isLoading: boolean;
  progress: number;
  handleAutoUpdateToggle: () => void;
  handleRealtimeAPIToggle: () => void;
  handleDateRangeChange: (date: Date) => void;
  handleEndDateChange: (date: Date) => void;
}

const ChartControls: React.FC<ChartControlsProps> = ({
  isAutoUpdate,
  isRealtimeAPIEnabled,
  dateRange,
  isLoading,
  progress,
  handleAutoUpdateToggle,
  handleRealtimeAPIToggle,
  handleDateRangeChange,
  handleEndDateChange
}) => {
  return (
    <div className="mb-4 space-y-4">
      {/* 자동 업데이트 설정 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white font-medium mb-3">실시간 업데이트 설정</div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAutoUpdateToggle}
            className={`px-4 py-2 rounded-md text-sm font-medium 
              ${isAutoUpdate ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {isAutoUpdate ? '자동 업데이트 ON' : '자동 업데이트 OFF'}
          </button>
          <button
            onClick={handleRealtimeAPIToggle}
            className={`px-4 py-2 rounded-md text-sm font-medium 
              ${isRealtimeAPIEnabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {isRealtimeAPIEnabled ? '실시간 API ON' : '실시간 API OFF'}
          </button>
        </div>
      </div>
      
      {/* 날짜 범위 설정 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white font-medium mb-3">날짜 범위 설정</div>
        <div className="flex flex-wrap gap-3">
          <div className="w-full md:w-auto">
            <div className="text-sm text-gray-400 mb-1">시작 날짜</div>
            <DatePicker
              selected={dateRange.startDate}
              onChange={(date: Date | null) => {
                if (date) handleDateRangeChange(date);
              }}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="시간"
              dateFormat="yyyy-MM-dd HH:mm"
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
            />
          </div>
          <div className="w-full md:w-auto">
            <div className="text-sm text-gray-400 mb-1">종료 날짜</div>
            <DatePicker
              selected={dateRange.endDate}
              onChange={(date: Date | null) => {
                if (date) handleEndDateChange(date);
              }}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="시간"
              dateFormat="yyyy-MM-dd HH:mm"
              className="bg-gray-700 text-white px-3 py-2 rounded w-full"
            />
          </div>
        </div>
      </div>
      
      {/* 로딩 프로그레스 바 */}
      {isLoading && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-white text-sm mb-2">데이터 로드 중: {progress}%</div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartControls; 