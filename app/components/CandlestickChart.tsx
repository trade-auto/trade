import { useEffect, useRef, useState } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';

declare global {
  interface Chart {
    crossHairMoved: (callback: (params: { price: number }) => void) => void;
  }

  interface Widget {
    onChartReady: (callback: () => void) => void;
    activeChart: () => Chart;
  }

  interface StudyInputs {
    [key: string]: number | string;
  }

  interface StudyStyle {
    color: string;
    linewidth: number;
  }

  interface StudyStyles {
    [key: string]: StudyStyle;
  }

  interface Study {
    name: string;
    inputs?: StudyInputs;
    styles?: StudyStyles;
  }

  interface TradingViewConfig {
    container_id: string;
    symbol: string;
    interval: string;
    timezone: string;
    theme: string;
    style: string;
    locale: string;
    toolbar_bg: string;
    enable_publishing: boolean;
    hide_side_toolbar: boolean;
    allow_symbol_change: boolean;
    save_image: boolean;
    height: string;
    width: string;
    autosize: boolean;
    studies: (string | Study)[];
    watchlist: string[];
    details: boolean;
    hotlist: boolean;
    calendar: boolean;
    show_popup_button: boolean;
    popup_width: string;
    popup_height: string;
    datafeed_mode: string;
    client_id: string;
    user_id: string;
    auto_save_delay: number;
  }

  interface Window {
    TradingView: {
      widget: new (config: TradingViewConfig) => Widget;
    };
  }
}

interface ChartProps {
  symbol: string;
}

export const CandlestickChart: React.FC<ChartProps> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);
  const { prices } = useUpbitStore();
  const [tradingViewPrice, setTradingViewPrice] = useState<number>(0);
  
  const currentPrice = prices[symbol]?.currentPrice ?? 0;
  const lastUpdated = prices[symbol]?.lastUpdated ?? '-';

  useEffect(() => {
    // TradingView 위젯 스크립트 로드
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView && container.current) {
        const widget = new window.TradingView.widget({
          container_id: container.current.id,
          symbol: `UPBIT:${symbol.replace('KRW-', '')}KRW`,
          interval: '3',
          timezone: 'Asia/Seoul',
          theme: 'dark',
          style: '1',
          locale: 'kr',
          toolbar_bg: '#1e1e1e',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          save_image: true,
          height: '1200',
          width: '100%',
          autosize: false,
          studies: [
            "Volume@tv-basicstudies",
            "MACD@tv-basicstudies",
            "RSI@tv-basicstudies"
          ],
          watchlist: [`UPBIT:${symbol.replace('KRW-', '')}KRW`],
          details: true,
          hotlist: true,
          calendar: true,
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
          datafeed_mode: 'streaming',
          client_id: 'tradingview.com',
          user_id: 'public_user_id',
          auto_save_delay: 5,
        });

        widget.onChartReady(() => {
          widget.activeChart().crossHairMoved(({ price }) => {
            if (price) {
              setTradingViewPrice(price);
            }
          });
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [symbol]);

  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && tradingViewPrice > 0 
    ? currentPrice - tradingViewPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && tradingViewPrice > 0
    ? (priceDiff / tradingViewPrice) * 100
    : 0;

  return (
    <div className="w-full min-h-screen p-4 bg-[#1e1e1e] rounded-lg">
      {/* 시세 비교 정보 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Upbit WebSocket 시세</div>
          <div className="text-white text-lg font-bold">
            {currentPrice.toLocaleString()} KRW
          </div>
          <div className="text-gray-400 text-xs">
            마지막 업데이트: {lastUpdated}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">TradingView 시세</div>
          <div className="text-white text-lg font-bold">
            {tradingViewPrice.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiff.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이 (%)</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiffPercentage.toFixed(4)}%
          </div>
        </div>
      </div>

      <div className="text-white text-lg font-bold mb-4">
        {symbol} 3분봉 차트
      </div>
      <div ref={container} id="tradingview_chart" style={{ height: "1200px" }} className="w-full" />
    </div>
  );
}; 