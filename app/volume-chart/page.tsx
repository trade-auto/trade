'use client';

import { useState } from 'react';
import UpbitVolumeChart from '../components/UpbitVolumeChart';
import { NavigationHeader } from '../components/NavigationHeader';

export default function VolumeChartPage() {
  const [market, setMarket] = useState<string>('KRW-BTC');
  const [interval, setInterval] = useState<string>('minutes/1');
  const [count, setCount] = useState<number>(200);

  // 마켓 목록
  const markets = [
    { value: 'KRW-BTC', label: '비트코인' },
    { value: 'KRW-ETH', label: '이더리움' },
    { value: 'KRW-XRP', label: '리플' },
    { value: 'KRW-SOL', label: '솔라나' },
    { value: 'KRW-ADA', label: '에이다' },
    { value: 'KRW-AVAX', label: '아발란체' },
    { value: 'KRW-DOT', label: '폴카닷' },
    { value: 'KRW-MATIC', label: '폴리곤' },
    { value: 'KRW-DOGE', label: '도지코인' },
    { value: 'KRW-SHIB', label: '시바이누' },
    { value: 'KRW-LINK', label: '체인링크' },
    { value: 'KRW-ATOM', label: '코스모스' },
  ];

  // 인터벌 목록
  const intervals = [
    { value: 'minutes/1', label: '1분' },
    { value: 'minutes/3', label: '3분' },
    { value: 'minutes/5', label: '5분' },
    { value: 'minutes/15', label: '15분' },
    { value: 'minutes/30', label: '30분' },
    { value: 'minutes/60', label: '1시간' },
    { value: 'minutes/240', label: '4시간' },
    { value: 'days', label: '일봉' },
  ];

  // 캔들 개수 목록
  const countOptions = [
    { value: 100, label: '100개' },
    { value: 200, label: '200개' },
    { value: 300, label: '300개' },
    { value: 400, label: '400개' },
    { value: 500, label: '500개' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <NavigationHeader currentPage="volume-chart" />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-2">거래량 분석 차트</h1>
        
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <p className="text-white mb-4">
            여기에서 다양한 암호화폐의 거래량 정보를 확인하고 분석할 수 있습니다. 
            캔들 방향에 따라 매수량과 매도량을 추정하여 보여드립니다.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium mb-1 text-white">마켓</label>
            <select
              className="w-full p-2 border rounded bg-gray-800 text-white"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              {markets.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-sm font-medium mb-1 text-white">기간</label>
            <select
              className="w-full p-2 border rounded bg-gray-800 text-white"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              {intervals.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-sm font-medium mb-1 text-white">캔들 개수</label>
            <select
              className="w-full p-2 border rounded bg-gray-800 text-white"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {countOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <UpbitVolumeChart 
            market={market}
            interval={interval}
            count={count}
            height={600}
          />
        </div>
        
        <div className="mt-6 text-white">
          <h2 className="text-xl font-semibold mb-2">
            차트 설명
          </h2>
          <p className="mb-2">
            • <strong>캔들스틱 차트</strong>: 가격 변동을 표시하며, 초록색은 상승, 빨간색은 하락을 나타냅니다.
          </p>
          <p className="mb-2">
            • <strong>볼린저 밴드</strong>: 파란색 선은 상단/하단 밴드, 주황색 선은 20기간 단순이동평균선(SMA)입니다.
          </p>
          <p className="mb-2">
            • <strong>거래량 차이 히스토그램</strong>: 초록색은 매수 우세(매수량큼 , 매도량적음), 빨간색은 매도 우세(매도량큼 , 매수량적음)를 의미합니다.
          </p>
        </div>
      </div>
    </div>
  );
} 