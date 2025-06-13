'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';
import { OrderHistory } from '../components/OrderHistory';
import { OrderDetail } from '../components/OrderDetail';
import { OrderListById } from '../components/OrderListById';
import { OpenOrders } from '../components/OpenOrders';
import { ClosedOrders } from '../components/ClosedOrders';
import { CreateOrder } from '../components/CreateOrder';
import { CandlestickChart, OrderParams } from '../components/CandlestickChart';
import PolMACDChartFixed from '../components/PolMACDChartFixed';
import SeparatedStrategyCharts from '../components/SeparatedStrategyCharts';
import { CandlestickData } from '../types/candlestick';
import { getAccountBalance } from '../api/upbitAccount';
import { useCoinStore, AVAILABLE_COINS } from '../store/useCoinStore';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' },
  { symbol: 'KRW-VANA', name: '바나' },
  { symbol: 'KRW-AUCTION', name: '옥션' }
];

// 사용 가능한 차트 인터벌
const CHART_INTERVALS = [
  { value: 'seconds/60', label: '초봉' },
  { value: 'minutes/5', label: '5분봉' },
  { value: 'minutes/15', label: '15분봉' },
];

export default function OrdersPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const { selectedCoin, setSelectedCoin } = useCoinStore();
  const [selectedOrderUuid, setSelectedOrderUuid] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selectedChartInterval');
        return saved || 'minutes/5';
      } catch (error) {
        console.warn('localStorage is not available:', error);
      }
    }
    return 'minutes/5';
  });
  const openOrdersRef = useRef<{ loadOpenOrders?: () => void }>({});
  const [currentPrice, setCurrentPrice] = useState<number>(3850);
  const [orderQuantity, setOrderQuantity] = useState<number>(12.9870);
  const [balance, setBalance] = useState<{
    coin: {
      currency: string;
      balance: number;
      avgBuyPrice: number;
      unitCurrency: string;
    } | null;
    krw: {
      currency: string;
      balance: number;
      unitCurrency: string;
    } | null;
  }>({ coin: null, krw: null });
  const [chartData, setChartData] = useState<CandlestickData[]>([]);

  // 시드 기반 의사 난수 생성기 (test-chart와 동일)
  function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 임시 데이터 생성 (PolMACD 차트용)
  const generateTempData = () => {
    const data = [];
    const baseTime = Math.floor(Date.now() / 1000) - (300 * 60); // 300분 전부터
    
    let basePrice = currentPrice || 50000;
    let trend = 1;
    let seed = 12345;
    
    console.log('🔢 차트 데이터 생성 시작, basePrice:', basePrice);
    
    for (let i = 0; i < 300; i++) {
      const time = baseTime + i * 60; // 1분 간격
      
      seed++;
      const volatility = 50 + seededRandom(seed) * 100;
      seed++;
      const trendChange = trend * (10 + seededRandom(seed) * 30);
      
      if (i > 50 && i % 80 === 0) {
        trend *= -1;
      }
      
      seed++;
      basePrice += trendChange + (seededRandom(seed) - 0.5) * volatility;
      
      if (basePrice < basePrice * 0.7) basePrice = basePrice * 0.7;
      if (basePrice > basePrice * 1.3) basePrice = basePrice * 1.3;
      
      seed++;
      const open = basePrice + (seededRandom(seed) - 0.5) * 200;
      seed++;
      const close = basePrice + (seededRandom(seed) - 0.5) * 200;
      seed++;
      const high = Math.max(open, close) + seededRandom(seed) * 300;
      seed++;
      const low = Math.min(open, close) - seededRandom(seed) * 300;
      
      data.push({
        time: time,
        open: open,
        high: high,
        low: Math.max(low, open * 0.95),
        close: close,
        volume: 500000 + seededRandom(seed++) * 1000000
      });
    }
    
    console.log('📊 생성된 차트 데이터 요약:', {
      총개수: data.length,
      첫번째: data[0],
      마지막: data[data.length - 1],
      가격범위: {
        최고: Math.max(...data.map(d => d.high)),
        최저: Math.min(...data.map(d => d.low))
      }
    });
    
    return data;
  };
  const createOrderRef = useRef<{ 
    handleAutomaticTrade: (params: {
      market: string;
      side: 'bid' | 'ask';
      volume: string;
      price: string;
      ord_type: string;
      mode: string;
    }) => Promise<void> 
  }>(null);

  // 클라이언트 사이드 마운트 및 localStorage 처리
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('selectedSymbol');
      if (saved) {
        setSelectedCoin(saved);
      }
      
      const savedInterval = localStorage.getItem('selectedChartInterval');
      if (savedInterval) {
        setSelectedInterval(savedInterval);
      }
    } catch (error) {
      console.warn('localStorage is not available:', error);
    }
  }, []);

  // WebSocket을 통해 실시간 가격 업데이트
  useEffect(() => {
    if (!mounted) return;

    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      
      ws.onopen = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify([
            { ticket: "trade" },
            { type: "trade", codes: [selectedCoin] }
          ]);
          ws.send(message);
        }
      };

      ws.onmessage = (event) => {
        if (!(event.data instanceof Blob)) {
          console.warn('Unexpected message format:', event.data);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = reader.result;
            if (typeof text !== 'string') {
              throw new Error('FileReader result is not a string');
            }

            const data = JSON.parse(text);
            if (data && data.type === 'trade' && typeof data.trade_price === 'number') {
              setCurrentPrice(data.trade_price);
            }
          } catch (error) {
            console.error('WebSocket 메시지 처리 오류:', error);
          }
        };

        reader.onerror = (error) => {
          console.error('FileReader 오류:', error);
        };

        reader.readAsText(event.data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket 오류:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
      };
    } catch (error) {
      console.error('WebSocket 초기화 오류:', error);
    }

    return () => {
      if (ws) {
        try {
          ws.close();
        } catch (error) {
          console.error('WebSocket 종료 오류:', error);
        }
      }
    };
  }, [selectedCoin, mounted]);

  // 잔고 정보 로드
  const loadBalance = useCallback(async () => {
    try {
      const accounts = await getAccountBalance();
      const coinBalance = accounts.find(
        account => `KRW-${account.currency}` === selectedCoin
      );
      const krwBalance = accounts.find(
        account => account.currency === 'KRW'
      );
      
      setBalance({
        coin: coinBalance || null,
        krw: krwBalance || null
      });
    } catch (error) {
      console.error('잔고 조회 실패:', error);
    }
  }, [selectedCoin]);

  // 심볼이 변경될 때마다 잔고 정보 업데이트
  useEffect(() => {
    loadBalance();
  }, [selectedCoin, loadBalance]);

  // 임시 차트 데이터 생성 (PolMACD 차트용)
  useEffect(() => {
    if (mounted && currentPrice) {
      const tempData = generateTempData();
      setChartData(tempData);
    }
  }, [mounted, currentPrice]);

  const handleOrderCreated = () => {
    // OpenOrders 컴포넌트의 새로고침 함수 호출
    if (openOrdersRef.current.loadOpenOrders) {
      openOrdersRef.current.loadOpenOrders();
    }
  };

  const handlePriceUpdate = (price: number) => {
    if (price) setCurrentPrice(price);
  };

  const handleQuantityUpdate = (quantity: number) => {
    if (quantity) setOrderQuantity(quantity);
  };

  const handleIntervalChange = useCallback((interval: string) => {
    setSelectedInterval(interval);
    if (mounted) {
      try {
        localStorage.setItem('selectedChartInterval', interval);
      } catch (error) {
        console.warn('Failed to save chart interval to localStorage:', error);
      }
    }
  }, [mounted]);

  if (!mounted) {
    return (
      <main className="min-h-screen p-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
            <div className="h-32 bg-gray-800 rounded mb-4"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="orders" />

        {/* 거래 모드 토글 */}
        <div className="mb-8 bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white">거래 모드</h2>
              <div className="flex items-center bg-gray-700 rounded-full p-1 w-32">
                <button
                  onClick={() => setMode('test')}
                  className={`flex-1 px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    mode === 'test' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-400'
                  }`}
                >
                  {mode === 'test' ? '✓ 테스트' : '테스트'}
                </button>
                <button
                  onClick={() => setMode('live')}
                  className={`flex-1 px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    mode === 'live' 
                      ? 'bg-red-500 text-white' 
                      : 'text-gray-400'
                  }`}
                >
                  {mode === 'live' ? '✓ 실전' : '실전'}
                </button>
              </div>
            </div>
            {mode === 'live' && (
              <div className="text-red-500 font-bold">
                ⚠️ 실제 자산으로 거래가 이루어집니다
              </div>
            )}
          </div>
        </div>

        {/* 심볼 선택 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">코인 선택</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COINS.map((item) => (
              <button
                key={item.symbol}
                onClick={() => setSelectedCoin(item.symbol)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-150 ${
                  selectedCoin === item.symbol
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* 주문하기 섹션 */}
        <CreateOrder
          ref={createOrderRef}
          market={selectedCoin}
          mode={mode}
          onOrderCreated={handleOrderCreated}
          onPriceUpdate={handlePriceUpdate}
          onQuantityUpdate={handleQuantityUpdate}
        />

        {/* 거래 예정 금액 섹션 */}
        <div className="mb-8 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4">거래 예정 정보</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-gray-400 text-sm">3초 중간가</div>
              <div className="text-white text-lg font-bold">
                {(currentPrice || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">수량</div>
              <div className="text-white text-lg font-bold">
                {(orderQuantity || 0).toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">예상 거래 금액</div>
              <div className="text-white text-lg font-bold">
                {((currentPrice || 0) * (orderQuantity || 0)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 잔고 정보 섹션 수정 */}
        <div className="mb-8 space-y-4">
          {/* 코인 잔고 정보 */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">매매코인 잔고</h2>
              <button
                onClick={loadBalance}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                새로고침
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-gray-400 text-sm">보유 수량</div>
                <div className="text-white text-lg font-bold">
                  {balance.coin ? balance.coin.balance.toFixed(4) : '0.0000'} {balance.coin?.currency}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">평균 매수가</div>
                <div className="text-white text-lg font-bold">
                  {balance.coin ? balance.coin.avgBuyPrice.toLocaleString() : '0'} {balance.coin?.unitCurrency}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">평가 금액</div>
                <div className="text-white text-lg font-bold">
                  {balance.coin 
                    ? (balance.coin.balance * currentPrice).toLocaleString() 
                    : '0'} {balance.coin?.unitCurrency}
                </div>
              </div>
            </div>
          </div>

          {/* 현금 잔고 정보 */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">현금 보유 잔고</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-sm">보유 현금</div>
                <div className="text-white text-lg font-bold">
                  {balance.krw ? balance.krw.balance.toLocaleString() : '0'} KRW
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">주문 가능</div>
                <div className="text-white text-lg font-bold">
                  {balance.krw ? (balance.krw.balance * 0.9995).toLocaleString() : '0'} KRW
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            {selectedInterval === 'seconds/60' ? '실시간 초봉 차트' : selectedInterval === 'minutes/5' ? '실시간 5분봉 차트' : '실시간 15분봉 차트'}
          </h2>
          
          {/* 캔들 증가 설명 */}
          <div className="bg-blue-800 p-3 rounded-lg mb-2 text-white">
            <span className="font-bold">💡 팁:</span> 차트 컨트롤 영역의 「캔들 데이터 설정」에서 「캔들 +100개 추가」 버튼을 클릭하면 더 많은 과거 데이터를 볼 수 있습니다.
          </div>
          
          <CandlestickChart 
            symbol={selectedCoin} 
            chartType={selectedInterval}
            initialAutoUpdate={true}
            mode={mode}
            initialDataCount={1000}
            handleOrder={async (params: OrderParams) => {
              try {
                if (createOrderRef.current) {
                  await createOrderRef.current.handleAutomaticTrade(params);
                } else {
                  console.warn('handleAutomaticTrade 실행 실패: createOrderRef.current is null');
                }
              } catch (error) {
                console.error('handleAutomaticTrade 실행 실패:', error);
              }
            }}
            onOrder={() => {}}
            onChartTypeChange={(type) => handleIntervalChange(type)}
            showMA={{
              five: false,
              ten: false,
              twenty: false,
              thirty: false,
              fortyEight: false,
              ninety: false,
              sixty: true,
              oneTwenty: true,
              twoForty: true,
              threeHundredSixty: true,
              sixHundred: true,
              nineHundred: true
            }}
          />
        </div>

        {/* PolMACD 분리된 전략 차트 섹션 */}
        {chartData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">PolMACD 분리된 전략 차트</h2>
            <div className="bg-gray-800 p-4 rounded-lg">
              <SeparatedStrategyCharts 
                data={chartData}
                height={400}
              />
            </div>
          </div>
        )}

        {/* 주문 목록 조회 섹션 */}
        <OrderList mode={mode} onSelectOrder={setSelectedOrderUuid} />

        {/* ID로 주문 조회 섹션 */}
        <OrderListById onSelectOrder={setSelectedOrderUuid} />

        {/* 체결 대기 주문 섹션 */}
        <OpenOrders 
          ref={openOrdersRef}
          market={selectedCoin}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 종료된 주문 섹션 */}
        <ClosedOrders 
          market={selectedCoin}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 내역 섹션 */}
        <OrderHistory 
          market={selectedCoin}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 상세 정보 섹션 */}
        <OrderDetail uuid={selectedOrderUuid} />
      </div>
    </main>
  );
} 