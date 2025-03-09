'use client';

import { useEffect, useState } from 'react';
import { useUpbitWebSocket } from '../hooks/useUpbitWebSocket';

interface RealTimeMonitorProps {
  symbol: string;
  onSignal?: (signalType: 'long' | 'exit', price: number) => void;
}

export function RealTimeMonitor({ symbol, onSignal }: RealTimeMonitorProps) {
  const { 
    currentPrice, 
    lastUpdated, 
    isConnected, 
    tradeSignal, 
    lastTrade, 
    candleCount,
    lastAnalysisTime,
    analysisState,
    isReadyForAnalysis 
  } = useUpbitWebSocket(symbol);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('대기 중');

  useEffect(() => {
    // 분석 상태에 따라 상태 메시지 업데이트
    if (analysisState === 'analyzing') {
      setAnalysisStatus('분석 중...');
    } else if (analysisState === 'complete') {
      setAnalysisStatus('분석 완료');
    } else if (analysisState === 'waiting') {
      setAnalysisStatus('대기 중...');
    } else {
      setAnalysisStatus('준비 완료');
    }
  }, [analysisState]);

  // 실시간 매수/매도 신호 발생 시 콜백 실행
  useEffect(() => {
    if (tradeSignal && currentPrice && onSignal) {
      onSignal(tradeSignal, currentPrice);
    }
  }, [tradeSignal, currentPrice, onSignal]);

  // 알림 권한 요청
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }

    if (Notification.permission === "granted") {
      setShowNotifications(true);
      return;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      setShowNotifications(permission === "granted");
    }
  };
  
  // 시간 포맷팅 함수
  const formatTimeAgo = (date: Date | null) => {
    if (!date) return '-';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}초 전`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    return `${Math.floor(diffSec / 3600)}시간 전`;
  };

  // 매수/매도 신호 발생 이벤트 리스너
  useEffect(() => {
    const bollingerCompleteHandler = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.type === 'bollingerAnalysisComplete') {
        console.log('볼린저 분석 완료 이벤트 감지 (UI)');
      }
    };
    
    window.addEventListener('bollingerAnalysisComplete', bollingerCompleteHandler);
    
    return () => {
      window.removeEventListener('bollingerAnalysisComplete', bollingerCompleteHandler);
    };
  }, []);

  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">실시간 매수 신호 모니터링</h2>
        <div className="flex items-center">
          <div 
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} mr-2`}
          ></div>
          <span className="text-white">{isConnected ? '연결됨' : '연결 끊김'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-400 text-sm">현재 가격</div>
          <div className="text-white text-lg font-bold">
            {currentPrice ? currentPrice.toLocaleString() + '원' : '-'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">마지막 업데이트</div>
          <div className="text-white text-lg font-bold">
            {lastUpdated ? formatTimeAgo(lastUpdated) : '-'}
          </div>
        </div>
      </div>
      
      {/* 데이터 수집 상태 표시 */}
      <div className="mb-4 p-3 rounded-lg bg-gray-700">
        <div className="flex justify-between mb-2">
          <div className="text-gray-300">캔들 데이터 수집</div>
          <div className="text-white font-bold">{candleCount} / 900</div>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${isReadyForAnalysis ? 'bg-green-500' : 'bg-blue-500'}`} 
            style={{ width: `${Math.min(100, (candleCount / 900) * 100)}%` }}
          ></div>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          {isReadyForAnalysis 
            ? '✅ 분석 준비 완료' 
            : `⏳ 분석을 위해 ${900 - candleCount}개의 캔들이 더 필요합니다`}
        </div>
        
        {lastAnalysisTime && (
          <div className="mt-2 text-sm text-gray-400">
            마지막 분석: {formatTimeAgo(lastAnalysisTime)}
          </div>
        )}
        
        {/* 분석 상태 표시 추가 */}
        <div className="mt-2 flex justify-between">
          <span className="text-sm text-gray-300">분석 상태:</span>
          <span className={`text-sm font-medium ${
            analysisState === 'analyzing' ? 'text-yellow-300' : 
            analysisState === 'complete' ? 'text-green-300' : 
            isReadyForAnalysis ? 'text-blue-300' : 'text-gray-300'
          }`}>
            {analysisStatus}
          </span>
        </div>
      </div>

      {!showNotifications && (
        <button
          onClick={requestNotificationPermission}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg mb-4"
        >
          알림 허용하기
        </button>
      )}

      {lastTrade && (
        <div className={`p-4 rounded-lg ${lastTrade.type === 'long' ? 'bg-green-800' : 'bg-red-800'}`}>
          <div className="text-white font-bold text-lg">
            {lastTrade.type === 'long' ? '📈 매수 신호 발생!' : '📉 매도 신호 발생!'}
          </div>
          <div className="text-white">
            가격: {lastTrade.price.toLocaleString()}원
          </div>
          <div className="text-gray-300 text-sm">
            신호 발생 시간: {new Date(lastTrade.time).toLocaleString()}
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-400">
        <p>* 이 모니터링은 실시간으로 들어오는 데이터를 기반으로 볼린저 전략을 분석합니다.</p>
        <p>* 충분한 데이터(900개 이상의 캔들)가 수집되어야 분석이 시작됩니다.</p>
        {isReadyForAnalysis && <p>* 현재 10초마다 자동으로 분석이 실행됩니다.</p>}
        {isReadyForAnalysis && <p>* 볼린저 전략 분석 완료 후 즉시 매수 분석이 실행됩니다.</p>}
        <p className="mt-2 text-yellow-400">* 차트 업데이트가 보이지 않는 경우:</p>
        <ul className="list-disc pl-5 text-yellow-300">
          <li>차트 영역에서 '실시간 업데이트' 버튼을 클릭하세요</li>
          <li>자동 업데이트 후 실시간 업데이트 활성화 필요</li>
          <li>차트 업데이트에는 약간의 지연이 있을 수 있습니다</li>
        </ul>
      </div>
    </div>
  );
} 