'use client';

import { useState, useEffect } from 'react';
import { CreateOrder } from '../components/CreateOrder';
import { OrderLimitSettings } from '../components/OrderLimitSettings';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

export default function OrderPage() {
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('KRW-BTC');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);

  useEffect(() => {
    // 클라이언트 사이드에서 localStorage 값을 불러옵니다
    const saved = localStorage.getItem('selectedSymbol');
    if (saved) {
      setSelectedSymbol(saved);
    }
  }, []);

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    localStorage.setItem('selectedSymbol', symbol);
  };

  const handleOrderCreated = () => {
    // 주문 생성 후 필요한 작업
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="order" />
        
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