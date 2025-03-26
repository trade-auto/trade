// 이 파일은 모듈화를 위해 여러 파일로 분리되었습니다.
// 아래 파일들을 참조하세요:
// - CandlestickChartTypes.ts: 타입 정의
// - CandlestickChartCore.tsx: 핵심 컴포넌트
// - CandlestickChartHooks.ts: 커스텀 훅
// - CandlestickChartUtils.ts: 유틸리티 함수
// - CandlestickChartBacktest.tsx: 백테스트 관련 기능
// - CandlestickChartCSV.tsx: CSV 관련 기능

import PolMACDChart from './PolMACDChart';
import { forwardRef, useState, useCallback } from 'react';
import { CandlestickChartProps, ChartRefs } from './CandlestickChartTypes';

// CandlestickChartCore를 CandlestickChart로 내보냅니다
export { default as CandlestickChart } from './CandlestickChartCore';
export type { OrderParams } from './CandlestickChartTypes';

// 이 컴포넌트는 다른 이름으로 내보냅니다 (예: ChartWithControls)
const ChartWithControls = forwardRef<ChartRefs, CandlestickChartProps>(({
  symbol,
  chartType,
  initialData,
  onPriceChange,
  onChangeQuantity,
  onMouseLeave,
  onOrder,
  onChartTypeChange,
  showMA: initialShowMA,
  mode = 'test',
}, ref) => {
  // 기존 상태 및 훅은 그대로 유지
  // ... existing code ...
  
  // 자동 업데이트 및 실시간 업데이트 상태 불러오기
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chartAutoUpdate');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chartRealtimeUpdate');
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  
  // 자동 업데이트 토글 함수
  const toggleAutoUpdate = useCallback(() => {
    const newValue = !isAutoUpdate;
    setIsAutoUpdate(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chartAutoUpdate', JSON.stringify(newValue));
    }
  }, [isAutoUpdate]);
  
  // 실시간 업데이트 토글 함수
  const toggleRealtimeUpdate = useCallback(() => {
    const newValue = !isRealtimeEnabled;
    setIsRealtimeEnabled(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chartRealtimeUpdate', JSON.stringify(newValue));
    }
  }, [isRealtimeEnabled]);
  
  // 기존 UI 코드를 수정해서 버튼 추가
  return (
    <div className="relative">
      {/* 차트 컨트롤 영역 추가 */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-lg font-bold text-white">{symbol} 차트</div>
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 rounded text-sm ${isAutoUpdate ? 'bg-green-600' : 'bg-gray-600'}`}
            onClick={toggleAutoUpdate}
          >
            자동 업데이트 {isAutoUpdate ? '켜짐' : '꺼짐'}
          </button>
          <button 
            className={`px-3 py-1 rounded text-sm ${isRealtimeEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
            onClick={toggleRealtimeUpdate}
          >
            실시간 업데이트 {isRealtimeEnabled ? '켜짐' : '꺼짐'}
          </button>
        </div>
      </div>
      
      {/* 기존 차트 컴포넌트 */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        {/* ... existing chart container code ... */}
        
        {/* chart component here... */}
      </div>
    </div>
  );
});

ChartWithControls.displayName = 'ChartWithControls';

export { ChartWithControls };
// export type { OrderParams }; // 이미 위에서 내보냈으므로 제거
