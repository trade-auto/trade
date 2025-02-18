'use client';

import { CreateOrder } from '../components/CreateOrder';
import { NavigationHeader } from '../components/NavigationHeader';

export default function OrderPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="orders" />
        
        {/* 주문하기 */}
        <CreateOrder market="KRW-BTC" />
      </div>
    </main>
  );
} 