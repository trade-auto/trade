import { useState } from 'react';
import { CreateOrder } from '../components/CreateOrder';
import { OrderLimitSettings } from '../components/OrderLimitSettings';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';

export default function OrderPage() {
  const [mode, setMode] = useState<'live' | 'test'>('test');

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="order" />
        
        {/* 주문하기 */}
        <CreateOrder market="KRW-BTC" mode={mode} />
        
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