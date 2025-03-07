import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { DateRange } from '../types/candlestick';
import { useUpbitStore } from '../store/useUpbitStore';

interface ChartControlsProps {
  dateRange: DateRange;
  progress: number;
  handleDateRangeChange: (date: Date) => void;
  handleEndDateChange: (date: Date) => void;
  handleResetTradeState?: () => void;
}

const ChartControls: React.FC<ChartControlsProps> = ({
  dateRange,
  progress,
  handleDateRangeChange,
  handleEndDateChange,
  handleResetTradeState
}) => {
  const { resetTradeState } = useUpbitStore();
  
  const onResetTradeState = () => {
    if (handleResetTradeState) {
      handleResetTradeState();
    } else {
      resetTradeState();
      console.log('거래 상태가 초기화되었습니다.');
      alert('거래 상태가 초기화되었습니다.');
    }
  };

  return (
    <div className="mb-4 space-y-4">
      {/* 날짜 범위 설정 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white font-medium mb-3">날짜 범위 설정</div>
        <div className="flex flex-wrap gap-3 z-10">
          <div className="w-full md:w-auto z-10">
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
              className="bg-gray-700 text-white px-3 py-2 rounded w-full "
            />
          </div>
          <div className="w-full md:w-auto z-10">
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
      { (
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
      
      {/* 거래 상태 초기화 버튼 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <button
          onClick={onResetTradeState}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          거래 상태 초기화
        </button>
      </div>
    </div>
  );
};

export default ChartControls; 