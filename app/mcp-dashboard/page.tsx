'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// 동적 임포트로 클라이언트 사이드에서만 로드
const MCPDashboard = dynamic(() => import('../components/MCPDashboard'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">로딩 중...</div>
});

export default function MCPDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <MCPDashboard />
    </div>
  );
}