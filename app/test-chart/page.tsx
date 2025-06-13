'use client';

import { useState } from 'react';
import PolMACDChart from '../components/PolMACDChartFixed';
import PolMACDChartSimple from '../components/PolMACDChartSimple';
import SimpleTestChart from '../components/SimpleTestChart';
import SeparatedStrategyCharts from '../components/SeparatedStrategyCharts';
import { Time } from 'lightweight-charts';

// 시드 기반 의사 난수 생성기
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 더미 데이터 생성 (조건을 만족하는 트렌드 데이터)
const generateDummyData = () => {
  const data = [];
  // 고정된 시간값 사용 (2024년 1월 1일 기준)
  const baseTime = 1704067200; // 2024-01-01 00:00:00 UTC
  
  let basePrice = 50000;
  let trend = 1; // 상승 트렌드
  let seed = 12345; // 고정된 시드값
  
  for (let i = 0; i < 300; i++) {
    const time = baseTime + i * 60; // 1분 간격
    
    // 트렌드 기반 가격 변동
    seed++;
    const volatility = 50 + seededRandom(seed) * 100;
    seed++;
    const trendChange = trend * (10 + seededRandom(seed) * 30);
    
    // 가끔 트렌드 변경 (조건 만족을 위해)
    if (i > 50 && i % 80 === 0) {
      trend *= -1;
    }
    
    seed++;
    basePrice += trendChange + (seededRandom(seed) - 0.5) * volatility;
    
    // 가격이 너무 낮아지지 않도록
    if (basePrice < 30000) basePrice = 30000;
    if (basePrice > 80000) basePrice = 80000;
    
    seed++;
    const open = basePrice + (seededRandom(seed) - 0.5) * 200;
    seed++;
    const close = basePrice + (seededRandom(seed) - 0.5) * 200;
    seed++;
    const high = Math.max(open, close) + seededRandom(seed) * 300;
    seed++;
    const low = Math.min(open, close) - seededRandom(seed) * 300;
    
    data.push({
      time: time as Time,
      open: open,
      high: high,
      low: Math.max(low, 100), // 최소 가격 보장
      close: close,
      volume: 500000 + seededRandom(seed++) * 1000000
    });
  }
  
  console.log('생성된 더미 데이터:', data.length, '개');
  console.log('첫 번째 데이터:', data[0]);
  console.log('마지막 데이터:', data[data.length - 1]);
  
  return data;
};

export default function TestChartPage() {
  const [dummyData] = useState(() => generateDummyData());

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-white text-2xl mb-4">PolMACDChart 직접 테스트</h1>
      

      <div style={{
        background: '#00ff00',
        color: '#000',
        padding: '10px',
        margin: '10px 0'
      }}>
        더미 데이터 개수: {dummyData.length}개
      </div>

      {/* 간단한 테스트 차트 먼저 */}
      <SimpleTestChart data={dummyData} />

      {/* 분리된 전략 차트 - 새로 추가 */}
      <div style={{
        background: '#1a1a1a',
        border: '3px solid #9C27B0',
        padding: '20px',
        margin: '20px 0',
        borderRadius: '8px'
      }}>
        <SeparatedStrategyCharts data={dummyData} height={400} />
      </div>


    </div>
  );
}