'use client';

import { useState } from 'react';
import { getAccountBalance } from '../api/upbitAccount';
import { OrderChanceInfo } from '../components/OrderChanceInfo';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderLimitSettings } from '../components/OrderLimitSettings';

const SYMBOLS = [
  { symbol: 'KRW-BTC', name: '비트코인' },
  { symbol: 'KRW-ETH', name: '이더리움' },
  { symbol: 'KRW-XRP', name: '리플' },
  { symbol: 'KRW-STORJ', name: '스토리지' },
  { symbol: 'KRW-ONDO', name: '온도' }
];

interface AccountInfo {
  currency: string;
  balance: number;
  avgBuyPrice: number;
  unitCurrency: string;
}

export default function AccountPage() {
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const saved = localStorage.getItem('selectedSymbol');
    return saved || 'KRW-BTC';
  });
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [selectedOrderUuid, setSelectedOrderUuid] = useState<string>('');

  const loadAccountInfo = async () => {
    try {
      setIsLoadingAccounts(true);
      setAccountError(null);
      const accountData = await getAccountBalance();
      setAccounts(accountData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setAccountError(`계좌 정보 로딩 실패: ${errorMsg}`);
      console.error('계좌 정보 로딩 오류:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    localStorage.setItem('selectedSymbol', symbol);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="account" />

        <h1 className="text-2xl font-bold text-white mb-8">계정 설정</h1>
        
        {/* 주문 제한 설정 */}
        <OrderLimitSettings />

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

        {/* 계좌 정보 섹션 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">계좌 정보</h2>
            <button
              onClick={loadAccountInfo}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              disabled={isLoadingAccounts}
            >
              {isLoadingAccounts ? '로딩 중...' : '새로고침'}
            </button>
          </div>

          {accountError && (
            <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
              {accountError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div
                key={account.currency}
                className="bg-gray-800 p-4 rounded-lg"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">화폐</span>
                  <span className="text-white font-bold">
                    {account.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">보유량</span>
                  <span className="text-white font-bold">
                    {account.balance.toLocaleString()} {account.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">평균 매수가</span>
                  <span className="text-white font-bold">
                    {account.avgBuyPrice.toLocaleString()} {account.unitCurrency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">평가금액</span>
                  <span className="text-white font-bold">
                    {(account.balance * account.avgBuyPrice).toLocaleString()} {account.unitCurrency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주문 가능 정보 섹션 */}
        <OrderChanceInfo market={selectedSymbol} />
      </div>
    </main>
  );
} 