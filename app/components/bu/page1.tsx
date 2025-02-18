'use client';

import { useUpbitWebSocket } from './hooks/useUpbitWebSocket';
//import { CandlestickChart } from './components/CandlestickChart5A2_1';
import { CandlestickChart } from './components/CandlestickChart5A8ok6';
import { useUpbitStore } from './store/useUpbitStore';
import { useState } from 'react';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

const CHART_TYPES = [
  { value: 'seconds/60', label: '1초봉' },
  { value: 'minutes/1', label: '1분봉' },
  { value: 'minutes/3', label: '3분봉' },
  { value: 'minutes/5', label: '5분봉' },
  { value: '240', label: '일봉' },
  { value: '7200', label: '월봉' },
  { value: '86400', label: '년봉' }
];

// 추가: 차트 모드 상태 (combined vs non-combined)
type ChartMode = "combined" | "non-combined";

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState('KRW-BTC');
  const [selectedChartType, setSelectedChartType] = useState('minutes/1');
  // 추가: 차트 모드 상태 변수 (기본은 non-combined)
  const [chartMode, setChartMode] = useState<ChartMode>("non-combined");
  
  // 선택된 심볼에 대해서만 WebSocket 연결
  useUpbitWebSocket(selectedSymbol);
  
  const { isConnected, prices } = useUpbitStore();
  const lastUpdated = prices[selectedSymbol]?.lastUpdated ?? '-';
  
  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          Upbit 실시간 모니터링
        </h1>
        
        {/* 심볼 선택 */}
        <div className="mb-8">
          <label className="text-gray-400 block mb-2">코인 선택</label>
          <select 
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-800 text-white p-2 rounded-lg w-48"
          >
            {SYMBOLS.map(({ symbol, name }) => (
              <option key={symbol} value={symbol}>
                {name} ({symbol.replace('KRW-', '')})
              </option>
            ))}
          </select>
        </div>
        
        {/* 상태 표시 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">연결 상태</div>
            <div className="text-white text-lg font-bold">
              {isConnected ? '연결됨' : '연결 끊김'}
              <span className={`ml-2 inline-block w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">마지막 업데이트</div>
            <div className="text-white text-lg font-bold">
              {lastUpdated}
            </div>
          </div>
        </div>
        
        {/* 차트 모드 선택 버튼 */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setChartMode("non-combined")}
            className={`px-4 py-2 rounded ${chartMode === "non-combined" ? "bg-blue-600" : "bg-gray-600"}`}
          >
            Non-Combined
          </button>
          <button
            onClick={() => setChartMode("combined")}
            className={`px-4 py-2 rounded ${chartMode === "combined" ? "bg-blue-600" : "bg-gray-600"}`}
          >
            Combined
          </button>
        </div>

        {/* 차트 그리드 또는 Combined 모드에 따른 단일 차트 렌더링 */}
        {chartMode === "combined" ? (
          <div className="bg-gray-800 p-4 rounded-lg mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              {SYMBOLS.find(s => s.symbol === selectedSymbol)?.name} Combined Chart
            </h2>
            <CandlestickChart 
              symbol={selectedSymbol} 
              chartType="combined"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {CHART_TYPES.map(({ value, label }) => (
              <div key={value} className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-bold text-white mb-4">
                  {SYMBOLS.find(s => s.symbol === selectedSymbol)?.name} {label}
                </h2>
                <CandlestickChart 
                  symbol={selectedSymbol} 
                  chartType={value}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
