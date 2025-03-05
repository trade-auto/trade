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
      {/* 데이터 로딩 제어 버튼 */}
      <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
        <div className="text-gray-400 text-sm">자동 데이터 업데이트</div>
        <div className="flex space-x-4">
          <button
            onClick={handleAutoUpdateToggle}
            className={`px-4 py-2 rounded-lg font-bold ${
              isAutoUpdate 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {isAutoUpdate ? '✓ 자동 업데이트' : '자동 업데이트'}
          </button>
          
          <button
            onClick={handleRealtimeAPIToggle}
            className={`px-4 py-2 rounded-lg font-bold ${
              isRealtimeAPIEnabled 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {isRealtimeAPIEnabled ? '✓ 실시간API업데이트' : '실시간API업데이트'}
          </button>
        </div>
      </div>

      {/* 시작 날짜 설정 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">시작 날짜</div>
        <DatePicker
          selected={dateRange.startDate}
          onChange={(date: Date | null) => {
            if (date) handleDateRangeChange(date);
          }}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={1}
          timeCaption="시간"
          dateFormat="yyyy-MM-dd HH:mm"
          maxDate={new Date()}
          className="bg-gray-700 text-white p-2 rounded w-full"
          popperClassName="react-datepicker-popper"
          popperPlacement="right-start"
          withPortal
          portalId="datepicker-portal"
        />
      </div>

      {/* 종료 날짜 설정 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">종료 날짜</div>
        <DatePicker
          selected={
            dateRange.endDate && dateRange.startDate &&
            dateRange.endDate.getTime() === new Date(dateRange.startDate.getTime() + 30 * 60 * 1000).getTime()
              ? null
              : dateRange.endDate
          }
          onChange={(date: Date | null) => {
            if (date) {
              handleEndDateChange(date);
            }
          }}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={1}
          timeCaption="시간"
          dateFormat="yyyy-MM-dd HH:mm"
          maxDate={new Date()}
          className="bg-gray-700 text-white p-2 rounded w-full"
          popperClassName="react-datepicker-popper"
          popperPlacement="right-start"
          withPortal
          portalId="datepicker-portal"
          placeholderText="종료 날짜 선택"
        />
      </div>

      {/* 로딩 프로그레스 바 */}
      {isLoading && (
        <div className="mb-4">
          <div className="text-gray-400 text-sm mb-2">데이터 로딩 중... {progress.toFixed(1)}%</div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartControls; 