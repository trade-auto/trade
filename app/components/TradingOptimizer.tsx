import React, { useState, useEffect, useRef } from 'react';
import { parseCSV } from '../utils/csvProcessor';
import { TradingOptimizer, BacktestResult, Trade } from '../utils/tradingOptimizer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, ScatterChart, ZAxis, Brush, ReferenceLine } from 'recharts';

interface TradingOptimizerProps {
  csvData?: string;
  initialCapital?: number;
  feeRate?: number;
  minProfitPct?: number;
  maxConsecutiveLosses?: number;
}

const TradingOptimizerComponent: React.FC<TradingOptimizerProps> = ({
  csvData,
  initialCapital = 10000,
  feeRate = 0.0005,
  minProfitPct = 0.0015,
  maxConsecutiveLosses = 3
}) => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [localCsvData, setLocalCsvData] = useState<string | null>(csvData || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV 파일 업로드 처리
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setLocalCsvData(content);
      };
      reader.readAsText(file);
    }
  };

  // 최적화 실행
  const runOptimization = async () => {
    if (!localCsvData) {
      setError('CSV 데이터가 없습니다. 파일을 업로드하세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 데이터 파싱
      const parsedData = parseCSV(localCsvData);
      
      // 최적화 인스턴스 생성
      const optimizer = new TradingOptimizer(
        initialCapital,
        feeRate,
        minProfitPct,
        maxConsecutiveLosses
      );
      
      // 기술적 지표 계산
      const prices = parsedData.map(d => d.close || d.trade_price);
      
      // 각 데이터 포인트에 대해 거래 시뮬레이션 실행
      for (let i = 20; i < parsedData.length; i++) {
        const priceWindow = prices.slice(0, i + 1);
        
        // RSI 계산 (14일)
        const rsi = calculateRSI(priceWindow, 14);
        
        // MACD 계산 (12, 26, 9)
        const [macdLine, macdSignal] = calculateMACD(priceWindow, 12, 26, 9);
        
        // 볼린저 밴드 계산 (20일, 2 표준편차)
        const [sma, upperBand, lowerBand] = calculateBollingerBands(priceWindow, 20, 2);
        
        // 모멘텀 계산 (10일)
        const momentum = calculateMomentum(priceWindow, 10);
        
        // 이동평균 계산
        const ma60 = calculateMA(priceWindow, 60);
        const ma120 = calculateMA(priceWindow, 120);
        const ma240 = calculateMA(priceWindow, 240);
        const ma300 = calculateMA(priceWindow, 300);
        const ma360 = calculateMA(priceWindow, 360);
        const ma900 = calculateMA(priceWindow, 900);
        
        // 거래 처리
        optimizer.processTrade(
          new Date(parsedData[i].timestamp || parsedData[i]['timestamp(KST)']),
          prices[i],
          rsi[rsi.length - 1],
          macdLine[macdLine.length - 1],
          macdSignal[macdSignal.length - 1],
          lowerBand[lowerBand.length - 1],
          upperBand[upperBand.length - 1],
          momentum[momentum.length - 1],
          ma60[ma60.length - 1],
          ma120[ma120.length - 1],
          ma240[ma240.length - 1],
          ma300[ma300.length - 1],
          ma360[ma360.length - 1],
          ma900[ma900.length - 1]
        );
      }
      
      // 최종 결과 설정
      setResult(optimizer.getFinalResult());
    } catch (err) {
      setError(`최적화 실행 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 선택 버튼 클릭 처리
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // 결과 차트 데이터 준비
  const prepareChartData = () => {
    if (!result) return { priceData: [], tradePoints: [], capitalHistory: [] };

    // 가격 데이터와 거래 데이터 결합
    const priceData = localCsvData ? parseCSV(localCsvData) : [];
    
    // 거래 포인트 표시를 위한 데이터 준비
    const tradePoints = result.trades.map(trade => ({
      time: trade.entryTime,
      price: trade.entryPrice,
      type: 'buy'
    })).concat(
      result.trades.map(trade => ({
        time: trade.exitTime,
        price: trade.exitPrice,
        type: 'sell'
      }))
    );

    // 자본금 변화 데이터 준비
    let capital = initialCapital;
    const capitalHistory = [{ time: new Date(0), capital }];

    result.trades.forEach(trade => {
      if (trade.exitTime.getTime() > 0) {
        capital = capital * (1 + trade.return);
        capitalHistory.push({ time: trade.exitTime, capital });
      }
    });

    return {
      priceData,
      tradePoints,
      capitalHistory
    };
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">거래 최적화 도구</h1>
      
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">설정</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">초기 자본금</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => initialCapital = Number(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">수수료율 (%)</label>
            <input
              type="number"
              value={feeRate * 100}
              onChange={(e) => feeRate = Number(e.target.value) / 100}
              step="0.001"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">최소 수익률 (%)</label>
            <input
              type="number"
              value={minProfitPct * 100}
              onChange={(e) => minProfitPct = Number(e.target.value) / 100}
              step="0.01"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">최대 연속 손실 횟수</label>
            <input
              type="number"
              value={maxConsecutiveLosses}
              onChange={(e) => maxConsecutiveLosses = Number(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">CSV 파일</label>
          <div className="flex items-center">
            <button
              onClick={handleSelectFile}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
            >
              파일 선택
            </button>
            <span className="text-sm text-gray-600">
              {csvFile ? csvFile.name : '선택된 파일 없음'}
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
          </div>
        </div>
        
        <button
          onClick={runOptimization}
          disabled={isLoading || !localCsvData}
          className={`px-4 py-2 rounded ${
            isLoading || !localCsvData
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isLoading ? '최적화 중...' : '최적화 실행'}
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {result && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">최적화 결과</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">총 거래 횟수</div>
              <div className="text-2xl font-bold">{result.totalTrades}</div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">성공 거래 횟수</div>
              <div className="text-2xl font-bold">{result.successfulTrades}</div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">성공률</div>
              <div className="text-2xl font-bold">{result.successRate.toFixed(2)}%</div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">총 수익률</div>
              <div className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.totalReturn.toFixed(2)}%
              </div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">평균 수익률</div>
              <div className={`text-2xl font-bold ${result.averageReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.averageReturn.toFixed(2)}%
              </div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">순 수익률 (수수료 제외)</div>
              <div className={`text-2xl font-bold ${result.totalNetReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.totalNetReturn.toFixed(2)}%
              </div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">평균 순 수익률</div>
              <div className={`text-2xl font-bold ${result.averageNetReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.averageNetReturn.toFixed(2)}%
              </div>
            </div>
            
            <div className="p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-600">최종 자본금</div>
              <div className="text-2xl font-bold">
                {(initialCapital * (1 + result.totalReturn / 100)).toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">가격 및 거래 차트</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareChartData().priceData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(timestamp: any) => new Date(timestamp).toLocaleTimeString()} 
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(label: any) => new Date(label).toLocaleString()}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}`, '가격']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="close" 
                    stroke="#8884d8" 
                    dot={false} 
                    name="가격" 
                  />
                  <Scatter
                    data={prepareChartData().tradePoints.filter((p: any) => p.type === 'buy')}
                    fill="green"
                    name="매수"
                    shape="triangle"
                  />
                  <Scatter
                    data={prepareChartData().tradePoints.filter((p: any) => p.type === 'sell')}
                    fill="red"
                    name="매도"
                    shape="triangle"
                  />
                  <Brush dataKey="timestamp" height={30} stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">자본금 변화 차트</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareChartData().capitalHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(time: any) => new Date(time).toLocaleTimeString()} 
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(label: any) => new Date(label).toLocaleString()}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}`, '자본금']}
                  />
                  <Legend />
                  <ReferenceLine y={initialCapital} stroke="red" strokeDasharray="3 3" />
                  <Line 
                    type="monotone" 
                    dataKey="capital" 
                    stroke="#82ca9d" 
                    name="자본금" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">거래 내역</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border">번호</th>
                    <th className="py-2 px-4 border">매수 시간</th>
                    <th className="py-2 px-4 border">매수 가격</th>
                    <th className="py-2 px-4 border">매도 시간</th>
                    <th className="py-2 px-4 border">매도 가격</th>
                    <th className="py-2 px-4 border">수익률</th>
                    <th className="py-2 px-4 border">결과</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, index) => (
                    <tr key={index} className={trade.isSuccess ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="py-2 px-4 border">{index + 1}</td>
                      <td className="py-2 px-4 border">{trade.entryTime.toLocaleString()}</td>
                      <td className="py-2 px-4 border">{trade.entryPrice.toFixed(2)}</td>
                      <td className="py-2 px-4 border">{trade.exitTime.getTime() > 0 ? trade.exitTime.toLocaleString() : '-'}</td>
                      <td className="py-2 px-4 border">{trade.exitPrice > 0 ? trade.exitPrice.toFixed(2) : '-'}</td>
                      <td className={`py-2 px-4 border ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(trade.return * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 px-4 border">{trade.isSuccess ? '성공' : '실패'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 기술적 지표 계산 함수들
function calculateRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = [];
  const deltas = prices.slice(1).map((price, i) => price - prices[i]);
  
  const gains = deltas.map(delta => Math.max(delta, 0));
  const losses = deltas.map(delta => Math.abs(Math.min(delta, 0)));
  
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
  
  result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  
  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  }
  
  return result;
}

function calculateMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): [number[], number[]] {
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  
  const macdLine = emaFast.map((value, i) => value - emaSlow[i]);
  const macdSignal = calculateEMA(macdLine, signal);
  
  return [macdLine, macdSignal];
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  
  // 첫 번째 값은 SMA로 초기화
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  result.push(ema);
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  
  return result;
}

function calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2): [number[], number[], number[]] {
  const sma: number[] = [];
  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / period;
    const std = Math.sqrt(slice.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / period);
    
    sma.push(avg);
    upperBand.push(avg + multiplier * std);
    lowerBand.push(avg - multiplier * std);
  }
  
  return [sma, upperBand, lowerBand];
}

function calculateMomentum(prices: number[], period: number = 10): number[] {
  const result: number[] = [];
  
  for (let i = period; i < prices.length; i++) {
    result.push((prices[i] / prices[i - period]) - 1);
  }
  
  return result;
}

function calculateMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / period;
    result.push(avg);
  }
  
  return result;
}

export default TradingOptimizerComponent; 