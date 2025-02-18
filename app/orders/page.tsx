'use client';

import { useState, useRef } from 'react';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';
import { OrderHistory } from '../components/OrderHistory';
import { OrderDetail } from '../components/OrderDetail';
import { OrderListById } from '../components/OrderListById';
import { OpenOrders } from '../components/OpenOrders';
import { ClosedOrders } from '../components/ClosedOrders';
import { CreateOrder } from '../components/CreateOrder';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

export default function OrdersPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('KRW-BTC');
  const [selectedOrderUuid, setSelectedOrderUuid] = useState<string>('');
  const openOrdersRef = useRef<{ loadOpenOrders?: () => void }>({});

  const handleOrderCreated = () => {
    // OpenOrders 컴포넌트의 새로고침 함수 호출
    if (openOrdersRef.current.loadOpenOrders) {
      openOrdersRef.current.loadOpenOrders();
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="orders" />

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

        {/* 주문하기 섹션 */}
        <CreateOrder 
          market={selectedSymbol}
          onOrderCreated={handleOrderCreated}
        />

        {/* 주문 목록 조회 섹션 */}
        <OrderList onSelectOrder={setSelectedOrderUuid} />

        {/* ID로 주문 조회 섹션 */}
        <OrderListById onSelectOrder={setSelectedOrderUuid} />

        {/* 체결 대기 주문 섹션 */}
        <OpenOrders 
          ref={openOrdersRef}
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 종료된 주문 섹션 */}
        <ClosedOrders 
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 내역 섹션 */}
        <OrderHistory 
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 상세 정보 섹션 */}
        <OrderDetail uuid={selectedOrderUuid} />
      </div>
    </main>
  );
} 