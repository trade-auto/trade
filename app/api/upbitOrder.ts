interface OrderChanceResponse {
  bid_fee: string;
  ask_fee: string;
  market: {
    id: string;
    name: string;
    order_types: string[];
    order_sides: string[];
    bid: { currency: string; price_unit: string; min_total: string };
    ask: { currency: string; price_unit: string; min_total: string };
    max_total: string;
    state: string;
  };
  bid_account: {
    currency: string;
    balance: string;
    locked: string;
    avg_buy_price: string;
    avg_buy_price_modified: boolean;
    unit_currency: string;
  };
  ask_account: {
    currency: string;
    balance: string;
    locked: string;
    avg_buy_price: string;
    avg_buy_price_modified: boolean;
    unit_currency: string;
  };
}

export const getOrderChance = async (market: string): Promise<OrderChanceResponse> => {
  try {
    const response = await fetch(`/api/orders/chance?market=${market}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 가능 정보 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 가능 정보 조회 중 오류:', error);
    throw new Error(`주문 가능 정보 로딩 실패: ${error.message}`);
  }
};

interface OrderResponse {
  uuid: string;
  side: 'ask' | 'bid';
  ord_type: 'limit' | 'price' | 'market';
  price: string;
  state: 'wait' | 'done' | 'cancel';
  market: string;
  created_at: string;
  volume: string;
  remaining_volume: string;
  reserved_fee: string;
  remaining_fee: string;
  paid_fee: string;
  locked: string;
  executed_volume: string;
  trades_count: number;
}

export const getOrder = async (uuid: string): Promise<OrderResponse> => {
  try {
    const response = await fetch(`/api/orders/${uuid}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 조회 중 오류:', error);
    throw new Error(`주문 조회 실패: ${error.message}`);
  }
};

// 주문 내역 조회 인터페이스 추가
interface OrderHistoryResponse {
  uuid: string;
  side: 'ask' | 'bid';
  ord_type: 'limit' | 'price' | 'market';
  price: string;
  state: 'wait' | 'done' | 'cancel';
  market: string;
  created_at: string;
  volume: string;
  remaining_volume: string;
  executed_volume: string;
  trades_count: number;
}

// 주문 내역 조회 함수
export const getOrderHistory = async (market: string): Promise<OrderHistoryResponse[]> => {
  try {
    const response = await fetch(`/api/orders/history?market=${market}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 내역 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 내역 조회 중 오류:', error);
    throw new Error(`주문 내역 조회 실패: ${error.message}`);
  }
};

// 주문 목록 조회 함수
export const getOrderList = async (uuids: string[], state: string = 'done'): Promise<OrderResponse[]> => {
  try {
    const uuidParams = uuids.map(uuid => `uuids[]=${uuid}`).join('&');
    const response = await fetch(`/api/orders/list?state=${state}&${uuidParams}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 목록 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 목록 조회 중 오류:', error);
    throw new Error(`주문 목록 조회 실패: ${error.message}`);
  }
};

// ID로 주문 목록 조회 함수
export const getOrdersByIds = async (uuids: string[]): Promise<OrderResponse[]> => {
  try {
    const uuidParams = uuids.map(uuid => `uuids[]=${uuid}`).join('&');
    const response = await fetch(`/api/orders/uuids?${uuidParams}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'ID로 주문 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('ID로 주문 조회 중 오류:', error);
    throw new Error(`ID로 주문 조회 실패: ${error.message}`);
  }
};

// 체결 대기 주문 조회 함수
export const getOpenOrders = async (market: string): Promise<OrderResponse[]> => {
  try {
    const response = await fetch(`/api/orders/open?market=${market}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '체결 대기 주문 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('체결 대기 주문 조회 중 오류:', error);
    throw new Error(`체결 대기 주문 조회 실패: ${error.message}`);
  }
};

// 종료된 주문 조회 함수
export const getClosedOrders = async (market: string): Promise<OrderResponse[]> => {
  try {
    const response = await fetch(`/api/orders/closed?market=${market}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '종료된 주문 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('종료된 주문 조회 중 오류:', error);
    throw new Error(`종료된 주문 조회 실패: ${error.message}`);
  }
};

// 주문 취소 함수
export const cancelOrder = async (uuid: string): Promise<OrderResponse> => {
  try {
    const response = await fetch(`/api/orders/cancel?uuid=${uuid}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 취소 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 취소 중 오류:', error);
    throw new Error(`주문 취소 실패: ${error.message}`);
  }
};

// 주문 일괄 취소 함수
export const cancelAllOrders = async (quoteCurrencies: string = 'KRW', excludedPairs: string = ''): Promise<any> => {
  try {
    const params = new URLSearchParams({
      quote_currencies: quoteCurrencies,
      excluded_pairs: excludedPairs,
    });
    
    const response = await fetch(`/api/orders/cancel-all?${params.toString()}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 일괄 취소 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 일괄 취소 중 오류:', error);
    throw new Error(`주문 일괄 취소 실패: ${error.message}`);
  }
};

interface CreateOrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: 'limit' | 'price' | 'market';
  mode?: 'test' | 'test-auto' | 'live-auto';
  isAutomatic?: boolean;
}

// 주문 생성 함수
export const createOrder = async (params: CreateOrderParams): Promise<OrderResponse> => {
  try {
    const response = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '주문 생성 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('주문 생성 중 오류:', error);
    throw new Error(`주문 생성 실패: ${error.message}`);
  }
};

interface CancelAndNewOrderParams {
  prev_order_uuid: string;
  new_ord_type: 'limit' | 'price' | 'market';
  new_price?: string;
  new_volume?: string | 'remain_only';
}

// 취소 후 재주문 함수
export const cancelAndNewOrder = async (params: CancelAndNewOrderParams): Promise<OrderResponse> => {
  try {
    const response = await fetch('/api/orders/cancel-and-new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '취소 후 재주문 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('취소 후 재주문 중 오류:', error);
    throw new Error(`취소 후 재주문 실패: ${error.message}`);
  }
};

// 현재가 조회 함수
export const getCurrentPrice = async (market: string): Promise<number> => {
  try {
    const response = await fetch(`/api/ticker?market=${market}`);
    
    if (!response.ok) {
      throw new Error('현재가 조회 실패');
    }

    const data = await response.json();
    return data.trade_price;
  } catch (error: any) {
    console.error('현재가 조회 중 오류:', error);
    throw error;
  }
};

// 3초 중간값 조회 함수 수정
export const get3SecMA = async (market: string): Promise<number> => {
  try {
    const response = await fetch(`/api/trades?market=${market}&count=3`);
    
    if (!response.ok) {
      throw new Error('3초 중간값 조회 실패');
    }

    const data = await response.json();
    
    // 가격들을 배열로 추출하고 정렬
    const prices = data
      .map((trade: any) => Number(trade.trade_price))
      .sort((a: number, b: number) => a - b);
    
    if (prices.length < 3) {
      return prices[0] || 0;
    }

    // 정렬된 배열에서 중간 인덱스(1)의 값을 반환
    return prices[1];

  } catch (error: any) {
    console.error('3초 중간값 조회 중 오류:', error);
    throw error;
  }
}; 