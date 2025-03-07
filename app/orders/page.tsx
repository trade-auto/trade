'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// 클라이언트 전용 컴포넌트 동적 로드
const OrdersPageContent = dynamic(() => import('../components/OrdersPageContent'), {
  ssr: false,
  loading: () => <div className="text-white p-4">로딩 중...</div>
});

export default function OrdersPage() {
  return <OrdersPageContent />;
} 