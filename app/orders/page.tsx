'use client';

import { useState, useRef, useEffect } from 'react';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';
import { OrderHistory } from '../components/OrderHistory';
import { OrderDetail } from '../components/OrderDetail';
import { OrderListById } from '../components/OrderListById';
import { OpenOrders } from '../components/OpenOrders';
import { ClosedOrders } from '../components/ClosedOrders';
import { CreateOrder } from '../components/CreateOrder';
import { CandlestickChart } from '../components/CandlestickChart5A8ok6';
import { getAccountBalance } from '../api/upbitAccount';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

export default function OrdersPage() {
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const saved = localStorage.getItem('selectedSymbol');
    return saved || 'KRW-BTC';
  });
  const [selectedOrderUuid, setSelectedOrderUuid] = useState<string>('');
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

  // WebSocket을 통해 실시간 가격 업데이트
  useEffect(() => {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    
    ws.onopen = () => {
      const message = JSON.stringify([
        { ticket: "trade" },
        { type: "trade", codes: [selectedSymbol] }
      ]);
      ws.send(message);
    };

    ws.onmessage = (event) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.type === 'trade') {
            setCurrentPrice(data.trade_price);
          }
        } catch (error) {
          console.error('JSON 파싱 오류:', error);
        }
      };
      reader.readAsText(event.data);
    };

    return () => ws.close();
  }, [selectedSymbol]);

  // 잔고 정보 로드
  const loadBalance = async () => {
    try {
      const accounts = await getAccountBalance();
      const coinBalance = accounts.find(
        account => `KRW-${account.currency}` === selectedSymbol
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
  };

  // 심볼이 변경될 때마다 잔고 정보 업데이트
  useEffect(() => {
    loadBalance();
  }, [selectedSymbol]);

  const handleOrderCreated = () => {
    // OpenOrders 컴포넌트의 새로고침 함수 호출
    if (openOrdersRef.current.loadOpenOrders) {
      openOrdersRef.current.loadOpenOrders();
    }
  };

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    localStorage.setItem('selectedSymbol', symbol);
  };

  const handlePriceUpdate = (price: number) => {
    if (price) setCurrentPrice(price);
  };

  const handleQuantityUpdate = (quantity: number) => {
    if (quantity) setOrderQuantity(quantity);
  };

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
                  테스트
                </button>
                <button
                  onClick={() => setMode('live')}
                  className={`flex-1 px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    mode === 'live' 
                      ? 'bg-red-500 text-white' 
                      : 'text-gray-400'
                  }`}
                >
                  실전
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
          <label className="text-gray-400 block mb-2">코인 선택</label>
          <select 
            value={selectedSymbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="bg-gray-800 text-white p-2 rounded-lg w-48"
          >
            {SYMBOLS.map(({ symbol, name }) => (
              <option key={symbol} value={symbol}>
                {name} ({symbol.replace('KRW-', '')})
              </option>
            ))}
          </select>
        </div>

        {/* 주문하기 섹션 */}
        <CreateOrder
          ref={createOrderRef}
          market={selectedSymbol}
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

        {/* 초봉 차트 섹션 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">실시간 초봉 차트</h2>
          <CandlestickChart 
            symbol={selectedSymbol} 
            chartType="seconds/60"
            initialAutoUpdate={true}
            mode={mode}
            handleOrder={async (params) => {
              try {
                if (createOrderRef.current) {
                  await createOrderRef.current.handleAutomaticTrade(params);
                  console.log('handleAutomaticTrade 실행 완료');
                } else {
                  console.warn('handleAutomaticTrade 실행 실패: createOrderRef.current is null');
                }
              } catch (error) {
                console.error('handleAutomaticTrade 실행 실패:', error);
              }
            }}
          />
        </div>

        {/* 주문 목록 조회 섹션 */}
        <OrderList mode={mode} onSelectOrder={setSelectedOrderUuid} />

        {/* ID로 주문 조회 섹션 */}
        <OrderListById onSelectOrder={setSelectedOrderUuid} />

        {/* 체결 대기 주문 섹션 */}
        <OpenOrders 
          ref={openOrdersRef}
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 종료된 주문 섹션 */}
        <ClosedOrders 
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 내역 섹션 */}
        <OrderHistory 
          market={selectedSymbol}
          onSelectOrder={setSelectedOrderUuid}
        />

        {/* 개별 주문 상세 정보 섹션 */}
        <OrderDetail uuid={selectedOrderUuid} />
      </div>
    </main>
  );
} 