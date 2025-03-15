import crypto from 'crypto';

interface UpbitAccount {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  avg_buy_price_modified: boolean;
  unit_currency: string;
}

export const getUpbitAccounts = async (): Promise<UpbitAccount[]> => {
  try {
    const response = await fetch('/api/accounts');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '계좌 조회 실패');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('계좌 조회 중 오류:', error);
    throw new Error(`계좌 정보 로딩 실패: ${error.message}`);
  }
};

// 계좌 잔고 조회 예시
export const getAccountBalance = async () => {
  try {
    const accounts = await getUpbitAccounts();
    return accounts.map(account => ({
      currency: account.currency,
      balance: parseFloat(account.balance),
      avgBuyPrice: parseFloat(account.avg_buy_price),
      unitCurrency: account.unit_currency,
    }));
  } catch (error) {
    console.error('잔고 조회 실패:', error);
    throw error;
  }
}; 