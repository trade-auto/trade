'use client';

import { useState, useRef } from 'react';
import { CreateOrder } from '../components/CreateOrder';
import { OrderLimitSettings } from '../components/OrderLimitSettings';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';
import { RealTimeMonitor } from '../components/RealTimeMonitor';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

export default function OrderPage() {
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const saved = localStorage.getItem('selectedSymbol');
    return saved || 'KRW-BTC';
  });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [autoTrading, setAutoTrading] = useState(false);
  
  // CreateOrder 컴포넌트에 대한 참조
  const createOrderRef = useRef<{ 
    handleAutomaticTrade?: (params: {
      market: string;
      side: 'bid' | 'ask';
      volume: string;
      price: string;
      ord_type: string;
      mode: string;
    }) => Promise<void> 
  }>({});

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    localStorage.setItem('selectedSymbol', symbol);
  };

  const handleOrderCreated = () => {
    // 주문 생성 후 필요한 작업
  };
  
  // 실시간 매수/매도 신호 처리
  const handleTradeSignal = async (signalType: 'long' | 'exit', price: number) => {
    console.log(`신호 감지: ${signalType}, 가격: ${price}`);
    
    // 자동 거래 모드가 켜져 있을 때만 처리
    if (autoTrading && createOrderRef.current.handleAutomaticTrade) {
      try {
        // 매수 신호
        if (signalType === 'long') {
          await createOrderRef.current.handleAutomaticTrade({
            market: selectedSymbol,
            side: 'bid', // 매수
            volume: '0.001', // 최소 수량 (실제로는 설정에 따라 조정 필요)
            price: price.toString(),
            ord_type: 'limit',
            mode: mode
          });
          console.log('자동 매수 주문 실행 완료');
        } 
        // 매도 신호
        else if (signalType === 'exit') {
          await createOrderRef.current.handleAutomaticTrade({
            market: selectedSymbol,
            side: 'ask', // 매도
            volume: '0.001', // 보유량에 따라 조정 필요
            price: price.toString(),
            ord_type: 'limit',
            mode: mode
          });
          console.log('자동 매도 주문 실행 완료');
        }
      } catch (error) {
        console.error('자동 거래 실행 중 오류:', error);
      }
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="order" />
        
        {/* 실시간 모니터링 컴포넌트 추가 */}
        <RealTimeMonitor 
          symbol={selectedSymbol}
          onSignal={handleTradeSignal}
        />
        
        {/* 자동 거래 설정 */}
        <div className="mb-8 bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">자동 거래 설정</h2>
            <div className="flex items-center">
              <span className="text-white mr-2">
                {autoTrading ? '활성화됨' : '비활성화됨'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoTrading}
                  onChange={() => setAutoTrading(!autoTrading)}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          {autoTrading && mode === 'live' && (
            <div className="mt-4 p-3 bg-red-800 text-white rounded-lg">
              ⚠️ 경고: 실전 모드에서 자동 거래가 활성화되어 있습니다. 실제 자산이 사용됩니다.
            </div>
          )}
          {autoTrading && mode === 'test' && (
            <div className="mt-4 p-3 bg-blue-800 text-white rounded-lg">
              ℹ️ 테스트 모드에서 자동 거래가 활성화되어 있습니다. 가상 자산으로 거래됩니다.
            </div>
          )}
        </div>
        
        {/* 심볼 선택 */}
        <div className="mb-8">
          <label className="text-gray-400 block mb-2">코인 선택</label>
          <select 
            value={selectedSymbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="bg-gray-800 text-white p-2 rounded-lg w-48"
          >
            {SYMBOLS.map(({ symbol, name }) => (
              <option key={symbol} value={symbol}>
                {name} ({symbol.replace('KRW-', '')})
              </option>
            ))}
          </select>
        </div>

        {/* 주문하기 */}
        <CreateOrder 
          ref={createOrderRef}
          market={selectedSymbol} 
          mode={mode} 
          onOrderCreated={handleOrderCreated}
          onPriceUpdate={setCurrentPrice}
          onQuantityUpdate={setOrderQuantity}
        />
        
        {/* 실전/테스트 모드 토글 */}
        <div className="mb-8 bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">거래 모드</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setMode('live')}
                className={`px-4 py-2 rounded ${
                  mode === 'live'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
              >
                실전 모드
              </button>
              <button
                onClick={() => setMode('test')}
                className={`px-4 py-2 rounded ${
                  mode === 'test'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
              >
                테스트 모드
              </button>
            </div>
          </div>
          {mode === 'live' && (
            <div className="mt-4 p-4 bg-red-900 text-white rounded">
              ⚠️ 실전 모드: 실제 자산으로 거래가 이루어집니다. 신중하게 거래해주세요.
            </div>
          )}
        </div>
        
        {/* 주문 제한 설정 */}
        <OrderLimitSettings />
        
        {/* 주문 목록 */}
        <OrderList mode={mode} />
      </div>
    </main>
  );
} 