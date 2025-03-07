import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  
  if (!market) {
    return NextResponse.json({ error: '마켓 코드가 필요합니다.' }, { status: 400 });
  }

  try {
    // 실제 API 호출 대신 더미 데이터 반환
    const dummyData = {
      bid_fee: 0.0005,
      ask_fee: 0.0005,
      market: {
        id: market,
        name: market.includes('KRW-') ? market.replace('KRW-', '') + '/KRW' : market,
        order_types: ['limit', 'price'],
        order_sides: ['ask', 'bid'],
        bid: { currency: 'KRW', price_unit: null, min_total: 5000 },
        ask: { currency: market.replace('KRW-', ''), price_unit: null, min_total: 0.00001 },
        max_total: 1000000000.0,
        state: 'active',
      },
      bid_account: {
        currency: 'KRW',
        balance: '10000000.0',
        locked: '0.0',
        avg_buy_price: '0',
        avg_buy_price_modified: false,
        unit_currency: 'KRW',
      },
      ask_account: {
        currency: market.replace('KRW-', ''),
        balance: '1.0',
        locked: '0.0',
        avg_buy_price: '3000000',
        avg_buy_price_modified: false,
        unit_currency: 'KRW',
      }
    };

    return NextResponse.json(dummyData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '주문 가능 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 