import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function HomePage() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto px-4">
      <div className="my-8 text-center">
        <h1 className="text-4xl font-bold mb-4">업비트 트레이딩 분석</h1>
        <h2 className="text-xl text-gray-600 mb-4">다양한 지표와 차트로 트레이딩을 분석하세요</h2>
        
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          <Link href="/account">
            <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              계정 관리
            </a>
          </Link>
          
          <Link href="/order">
            <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              주문 등록
            </a>
          </Link>
          
          <Link href="/orders">
            <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              주문 조회
            </a>
          </Link>
          
          <Link href="/volume-chart">
            <a className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
              거래량 분석 차트
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
} 