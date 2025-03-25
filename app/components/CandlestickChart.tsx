// 이 파일은 모듈화를 위해 여러 파일로 분리되었습니다.
// 아래 파일들을 참조하세요:
// - CandlestickChartTypes.ts: 타입 정의
// - CandlestickChartCore.tsx: 핵심 컴포넌트
// - CandlestickChartHooks.ts: 커스텀 훅
// - CandlestickChartUtils.ts: 유틸리티 함수
// - CandlestickChartBacktest.tsx: 백테스트 관련 기능
// - CandlestickChartCSV.tsx: CSV 관련 기능

import PolMACDChart from './PolMACDChart';

export { default as CandlestickChart } from './CandlestickChartCore';
export type { OrderParams } from './CandlestickChartTypes';

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  // ... existing code ...
}) => {
  // ... existing code ...

  return (
    <div className="flex flex-col gap-4">
      {/* 기존 차트 */}
      <div className="relative" style={{ height: `${chartHeight}px` }}>
        {/* ... existing code ... */}
      </div>

      {/* 폴MACD 차트 */}
      <div className="relative" style={{ height: '300px' }}>
        <PolMACDChart data={allData} />
      </div>
    </div>
  );
};

export default CandlestickChart;
