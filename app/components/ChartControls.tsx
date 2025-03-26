import React, { useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { DateRange } from '../types/candlestick';
import { SeriesMarker, Time } from 'lightweight-charts';

interface ChartControlsProps {
  dateRange: DateRange;
  progress: number;
  handleDateRangeChange?: (date: Date) => void;
  handleEndDateChange?: (date: Date) => void;
  isAutoUpdate?: boolean;
  isRealtimeAPIEnabled?: boolean;
  handleAutoUpdateToggle?: () => void;
  handleRealtimeAPIToggle?: () => void;
  realtimeUpdateStatus?: {
    isUpdating: boolean;
    lastUpdateTime: string | null;
    updateCount: number;
    markers: SeriesMarker<Time>[];
  };
  dataCount?: number;
  increaseDataCount?: () => void;
  decreaseDataCount?: () => void;
}

const ChartControls: React.FC<ChartControlsProps> = ({
  dateRange,
  progress,
  handleDateRangeChange,
  handleEndDateChange,
  isAutoUpdate = false,
  isRealtimeAPIEnabled = false,
  handleAutoUpdateToggle,
  handleRealtimeAPIToggle,
  realtimeUpdateStatus,
  dataCount = 200,
  increaseDataCount,
  decreaseDataCount
}) => {
  // 함수가 제대로 전달되었는지 확인
  const canChangeDateRange = handleDateRangeChange && typeof handleDateRangeChange === 'function';
  const canChangeEndDate = handleEndDateChange && typeof handleEndDateChange === 'function';
  const canIncreaseDataCount = increaseDataCount && typeof increaseDataCount === 'function';
  const canDecreaseDataCount = decreaseDataCount && typeof decreaseDataCount === 'function';

  // 컴포넌트 마운트 시 자동 업데이트 시작
  useEffect(() => {
    if (handleAutoUpdateToggle && !isAutoUpdate) {
      handleAutoUpdateToggle();
    }
  }, []);

  // 데이터 로드가 100%일 때 실시간 업데이트로 전환
  useEffect(() => {
    if (progress === 100 && handleRealtimeAPIToggle && !isRealtimeAPIEnabled && handleAutoUpdateToggle) {
      // 자동 업데이트 끄기
      if (isAutoUpdate) {
        handleAutoUpdateToggle();
      }
      // 실시간 업데이트 켜기
      handleRealtimeAPIToggle();
    }
  }, [progress, isRealtimeAPIEnabled, handleRealtimeAPIToggle, isAutoUpdate, handleAutoUpdateToggle]);

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
                if (date && canChangeDateRange) handleDateRangeChange(date);
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
                if (date && canChangeEndDate) handleEndDateChange(date);
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
      
      {/* 캔들 개수 컨트롤 패널 */}
      <div className="bg-blue-900 p-4 rounded-lg border-2 border-blue-500">
        <div className="text-white text-sm mb-2 font-bold">캔들 데이터 설정</div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-white text-sm">
            현재 로드된 캔들 개수: <span className="font-bold text-xl text-white">{dataCount}개</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => increaseDataCount && increaseDataCount()}
            disabled={!canIncreaseDataCount}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg ${!canIncreaseDataCount ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}`}
          >
            캔들 +100개 추가 ⬆️
          </button>
          <button
            onClick={() => decreaseDataCount && decreaseDataCount()}
            disabled={!canDecreaseDataCount || dataCount <= 200}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg ${(!canDecreaseDataCount || dataCount <= 200) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            캔들 -100개 감소 ⬇️
          </button>
        </div>
      </div>
      
      {/* 업데이트 컨트롤 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white font-medium mb-3">차트 업데이트 설정</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={handleAutoUpdateToggle}
            disabled={!handleAutoUpdateToggle || isRealtimeAPIEnabled}
            className={`px-3 py-1 rounded transition-colors ${
              isAutoUpdate ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white ${(!handleAutoUpdateToggle || isRealtimeAPIEnabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            자동 업데이트 {isAutoUpdate ? '켜짐' : '꺼짐'}
          </button>
          
          <button
            onClick={handleRealtimeAPIToggle}
            disabled={!handleRealtimeAPIToggle}
            className={`px-3 py-1 rounded transition-colors ${
              isRealtimeAPIEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white ${!handleRealtimeAPIToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            실시간 업데이트 {isRealtimeAPIEnabled ? '켜짐' : '꺼짐'}
          </button>
        </div>
        
        {/* 실시간 업데이트 상태 표시 */}
        {realtimeUpdateStatus && (
          <div className="text-xs text-gray-400">
            {realtimeUpdateStatus.isUpdating ? (
              <span className="text-blue-400">업데이트 중...</span>
            ) : realtimeUpdateStatus.lastUpdateTime ? (
              <span>마지막 업데이트: {realtimeUpdateStatus.lastUpdateTime} (총 {realtimeUpdateStatus.updateCount}회)</span>
            ) : (
              <span>업데이트 대기 중</span>
            )}
          </div>
        )}
      </div>
      
      {/* 로딩 프로그레스 바 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white text-sm mb-2">
          데이터 로드 중: {progress}%
          {progress === 100 && isRealtimeAPIEnabled && (
            <span className="ml-2 text-green-400">(실시간 업데이트로 전환됨)</span>
          )}
        </div>
        <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ease-in-out ${
              progress === 100 ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ChartControls; 