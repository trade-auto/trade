'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // 홈 페이지에 접근하면 계정 페이지로 리디렉션
    router.push('/account');
  }, [router]);
  
  return null; // 리디렉션되기 전에 빈 페이지 표시
}
