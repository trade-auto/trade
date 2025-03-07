'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MASettings } from '../types/candlestick';

interface ChartSettingsProps {
  showMA: MASettings;
  updateShowMA: (newShowMA: MASettings) => void;
  chartHeight: number;
  handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const STORAGE_KEY = 'chart_ma_settings';

// 기본 MA 설정값 정의
const DEFAULT_MA_SETTINGS: MASettings = {
  sixty: false,
  oneTwenty: false,
  twoForty: false,
  threeHundredSixty: false,
  threeHundred: false,
  nineHundred: false,
  twelveHundred: false
};

const ChartSettings: React.FC<ChartSettingsProps> = ({
  showMA = DEFAULT_MA_SETTINGS,
  updateShowMA,
  chartHeight,
  handleHeightChange
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // MA 토글 함수
  const toggleMA = useCallback((key: keyof MASettings) => {
    const updatedShowMA = { ...showMA };
    updatedShowMA[key] = !updatedShowMA[key];
    
    // 로컬 스토리지에 저장 (클라이언트 사이드에서만)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedShowMA));
      } catch (error) {
        console.error('MA 설정 저장 오류:', error);
      }
    }
    
    updateShowMA(updatedShowMA);
  }, [showMA, updateShowMA]);

  // 실제 사용할 MA 설정 (showMA가 없을 경우 기본값 사용)
  const currentShowMA = showMA || DEFAULT_MA_SETTINGS;

  // 서버 사이드 렌더링 시에는 기본 UI를 반환
  if (!mounted) {
    return null;
  }

  return (
    <div className="mb-4 space-y-4">
      {/* MA 설정 패널 */}
      <div className="grid grid-cols-1 gap-4 bg-gray-800 p-4 rounded-lg">
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 설정</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => toggleMA('sixty')}
              className={`px-2 py-1 rounded ${currentShowMA.sixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.sixty ? '✓ 60MA 보기' : '60MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('oneTwenty')}
              className={`px-2 py-1 rounded ${currentShowMA.oneTwenty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.oneTwenty ? '✓ 120MA 보기' : '120MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('twoForty')}
              className={`px-2 py-1 rounded ${currentShowMA.twoForty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.twoForty ? '✓ 240MA 보기' : '240MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('threeHundredSixty')}
              className={`px-2 py-1 rounded ${currentShowMA.threeHundredSixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.threeHundredSixty ? '✓ 360MA 보기' : '360MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('threeHundred')}
              className={`px-2 py-1 rounded ${currentShowMA.threeHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.threeHundred ? '✓ 300MA 보기' : '300MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('nineHundred')}
              className={`px-2 py-1 rounded ${currentShowMA.nineHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.nineHundred ? '✓ 900MA 보기' : '900MA 숨김'}
            </button>
            <button
              onClick={() => toggleMA('twelveHundred')}
              className={`px-2 py-1 rounded ${currentShowMA.twelveHundred ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {currentShowMA.twelveHundred ? '✓ 1200MA 보기' : '1200MA 숨김'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 차트 높이 조절 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">차트 높이 조절</div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="300"
            max="800"
            step="50"
            value={chartHeight}
            onChange={handleHeightChange}
            className="flex-1"
          />
          <div className="text-white font-bold w-20 text-center">{chartHeight}px</div>
        </div>
      </div>
    </div>
  );
};

export default ChartSettings; 