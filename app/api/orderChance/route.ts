import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  
  if (!market) {
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    // 테스트 데이터 반환
    return NextResponse.json({
      bid_fee: "0.0005",
      ask_fee: "0.0005",
      market: {
        id: market,
        name: "비트코인",
        order_types: ["limit", "price"],
        order_sides: ["ask", "bid"],
        bid: { currency: "KRW", price_unit: null, min_total: 5000 },
        ask: { currency: "BTC", price_unit: null, min_total: 5000 },
        max_total: "1000000000.0",
        state: "active",
      },
      bid_account: {
        currency: "KRW",
        balance: "10000000.0",
        locked: "0.0",
        avg_buy_price: "0",
        avg_buy_price_modified: false,
        unit_currency: "KRW",
      },
      ask_account: {
        currency: "BTC",
        balance: "2.0",
        locked: "0.0",
        avg_buy_price: "20000000",
        avg_buy_price_modified: false,
        unit_currency: "KRW",
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '주문 가능 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 