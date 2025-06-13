'use client';

import { useState } from 'react';
import PolMACDChart from '../components/PolMACDChart';
import PolMACDChartSimple from '../components/PolMACDChartSimple';
import SimpleTestChart from '../components/SimpleTestChart';

// 더미 데이터 생성 (조건을 만족하는 트렌드 데이터)
const generateDummyData = () => {
  const data = [];
  const now = Date.now() / 1000;
  
  let basePrice = 50000;
  let trend = 1; // 상승 트렌드
  
  for (let i = 0; i < 300; i++) {
    const time = now - (300 - i - 1) * 60; // 1분 간격 (시간 순서 수정)
    
    // 트렌드 기반 가격 변동
    const volatility = 50 + Math.random() * 100;
    const trendChange = trend * (10 + Math.random() * 30);
    
    // 가끔 트렌드 변경 (조건 만족을 위해)
    if (i > 50 && i % 80 === 0) {
      trend *= -1;
    }
    
    basePrice += trendChange + (Math.random() - 0.5) * volatility;
    
    // 가격이 너무 낮아지지 않도록
    if (basePrice < 30000) basePrice = 30000;
    if (basePrice > 80000) basePrice = 80000;
    
    const open = basePrice + (Math.random() - 0.5) * 200;
    const close = basePrice + (Math.random() - 0.5) * 200;
    const high = Math.max(open, close) + Math.random() * 300;
    const low = Math.min(open, close) - Math.random() * 300;
    
    data.push({
      time: time,
      open: open,
      high: high,
      low: Math.max(low, 100), // 최소 가격 보장
      close: close,
      volume: 500000 + Math.random() * 1000000
    });
  }
  
  console.log('생성된 더미 데이터:', data.length, '개');
  console.log('첫 번째 데이터:', data[0]);
  console.log('마지막 데이터:', data[data.length - 1]);
  
  return data;
};

export default function TestChartPage() {
  const [dummyData] = useState(generateDummyData);

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

      {/* 간단한 PolMACDChart 버전 */}
      <PolMACDChartSimple data={dummyData} height={600} showMA={true} />

      {/* 실제 PolMACDChart */}
      <div style={{
        background: '#e3f2fd',
        border: '3px solid blue',
        padding: '10px',
        margin: '10px 0'
      }}>
        <div style={{ color: 'blue', fontWeight: 'bold', marginBottom: '10px' }}>
          실제 PolMACDChart 렌더링 영역:
        </div>
        <PolMACDChart 
          data={dummyData}
          height={600}
          showMA={{
            five: false,
            ten: false,
            twenty: false,
            thirty: false,
            fortyEight: false,
            sixty: false,
            ninety: false,
            oneTwenty: false,
            twoForty: false,
            threeHundredSixty: false,
            sixHundred: false,
            nineHundred: false,
          }}
        />
      </div>
    </div>
  );
}