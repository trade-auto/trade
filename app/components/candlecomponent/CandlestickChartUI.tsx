import React from 'react';
import DatePicker from 'react-datepicker';
import { BacktestResult, Trade } from './CandlestickChartTypes';
import { formatTime } from './CandlestickChartHelpers';

interface ChartControlsProps {
  isAutoUpdate: boolean;
  isRealtimeAPIEnabled: boolean;
  isWebSocketEnabled?: boolean;
  handleAutoUpdateToggle: () => void;
  handleRealtimeAPIToggle: () => void;
  handleWebSocketToggle?: () => void;
}

export const ChartControls: React.FC<ChartControlsProps> = ({
  isAutoUpdate,
  isRealtimeAPIEnabled,
  isWebSocketEnabled = false,
  handleAutoUpdateToggle,
  handleRealtimeAPIToggle,
  handleWebSocketToggle
}) => {
  return (
    <div className="mb-4">
      <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
        <div className="text-gray-400 text-sm">자동 데이터 업데이트</div>
        <div className="flex space-x-4">
          <button
            onClick={handleAutoUpdateToggle}
            className={`px-4 py-2 rounded-lg font-bold ${
              isAutoUpdate 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {isAutoUpdate ? '✓ 자동 업데이트' : '자동 업데이트'}
          </button>
          
          <button
            onClick={handleRealtimeAPIToggle}
            className={`px-4 py-2 rounded-lg font-bold ${
              isRealtimeAPIEnabled 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {isRealtimeAPIEnabled ? '✓ 실시간API업데이트' : '실시간API업데이트'}
          </button>
          
          {handleWebSocketToggle && (
            <button
              onClick={handleWebSocketToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isWebSocketEnabled 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isWebSocketEnabled ? '✓ 웹소켓 연결' : '웹소켓 연결'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date | null;
  handleDateChange: (date: Date) => void;
  handleEndDateChange: (date: Date) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  handleDateChange,
  handleEndDateChange
}) => {
  return (
    <>
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">시작 날짜</div>
          <DatePicker
            selected={startDate}
            onChange={(date: Date | null) => {
              if (date) handleDateChange(date);
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={1}
            timeCaption="시간"
            dateFormat="yyyy-MM-dd HH:mm"
            maxDate={new Date()}
            className="bg-gray-700 text-white p-2 rounded w-full"
            popperClassName="react-datepicker-popper"
            popperPlacement="right-start"
            withPortal
            portalId="datepicker-portal"
          />
        </div>
      </div>
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">종료 날짜</div>
          <DatePicker
            selected={
              endDate && startDate &&
              endDate.getTime() === new Date(startDate.getTime() + 30 * 60 * 1000).getTime()
                ? null
                : endDate
            }
            onChange={(date: Date | null) => {
              if (date) {
                handleEndDateChange(date);
              }
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={1}
            timeCaption="시간"
            dateFormat="yyyy-MM-dd HH:mm"
            maxDate={new Date()}
            className="bg-gray-700 text-white p-2 rounded w-full"
            popperClassName="react-datepicker-popper"
            popperPlacement="right-start"
            withPortal
            portalId="datepicker-portal"
            placeholderText="종료 날짜 선택"
          />
        </div>
      </div>
    </>
  );
};

interface MAControlsProps {
  showMA: {
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
  };
  updateShowMA: (key: string) => void;
}

export const MAControls: React.FC<MAControlsProps> = ({ showMA, updateShowMA }) => {
  return (
    <div className="grid grid-cols-3 gap-4 bg-gray-800 p-4 rounded-lg mb-4">
      <div className="bg-gray-700 p-3 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">MA 설정</div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => updateShowMA('sixty')}
            className={`px-2 py-1 rounded ${showMA.sixty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            {showMA.sixty ? '✓ 60MA 보기' : '60MA 숨김'}
          </button>
          <button
            onClick={() => updateShowMA('oneTwenty')}
            className={`px-2 py-1 rounded ${showMA.oneTwenty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            {showMA.oneTwenty ? '✓ 120MA 보기' : '120MA 숨김'}
          </button>
          <button
            onClick={() => updateShowMA('twoForty')}
            className={`px-2 py-1 rounded ${showMA.twoForty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            {showMA.twoForty ? '✓ 240MA 보기' : '240MA 숨김'}
          </button>
          <button
            onClick={() => updateShowMA('threeHundredSixty')}
            className={`px-2 py-1 rounded ${showMA.threeHundredSixty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            {showMA.threeHundredSixty ? '✓ 360MA 보기' : '360MA 숨김'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PriceInfoProps {
  currentPrice: number;
  chartPrice: number;
  lastUpdated: string;
  priceDiff: number;
  priceDiffPercentage: number;
}

export const PriceInfo: React.FC<PriceInfoProps> = ({
  currentPrice,
  chartPrice,
  lastUpdated,
  priceDiff,
  priceDiffPercentage
}) => {
  return (
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
        <div className="text-gray-400 text-sm">차트 시세</div>
        <div className="text-white text-lg font-bold">
          {chartPrice.toLocaleString()} KRW
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
  );
};

interface BacktestResultsProps {
  backtestResult: BacktestResult | null;
}

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtestResult }) => {
  if (!backtestResult) return null;
  
  return (
    <div className="mt-8 bg-gray-800 p-4 rounded-lg">
      <h3 className="text-white text-lg font-bold mb-4">백테스트 결과</h3>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">총 거래 횟수</div>
          <div className="text-white text-lg font-bold">{backtestResult.totalTrades}</div>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">성공 거래 횟수</div>
          <div className="text-white text-lg font-bold">{backtestResult.successfulTrades}</div>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">성공률</div>
          <div className="text-white text-lg font-bold">{backtestResult.successRate.toFixed(2)}%</div>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">총 수익률</div>
          <div className={`text-lg font-bold ${backtestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {backtestResult.totalReturn.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <h4 className="text-white font-bold mb-2">거래 내역</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-700 rounded-lg">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-gray-400">진입 시간</th>
                <th className="px-4 py-2 text-left text-gray-400">청산 시간</th>
                <th className="px-4 py-2 text-left text-gray-400">진입 가격</th>
                <th className="px-4 py-2 text-left text-gray-400">청산 가격</th>
                <th className="px-4 py-2 text-left text-gray-400">수익률</th>
                <th className="px-4 py-2 text-left text-gray-400">결과</th>
              </tr>
            </thead>
            <tbody>
              {backtestResult.trades.map((trade: Trade, index: number) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700'}>
                  <td className="px-4 py-2 text-white">{formatTime(trade.entryTime)}</td>
                  <td className="px-4 py-2 text-white">{formatTime(trade.exitTime)}</td>
                  <td className="px-4 py-2 text-white">{trade.entryPrice.toLocaleString()}</td>
                  <td className="px-4 py-2 text-white">{trade.exitPrice.toLocaleString()}</td>
                  <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.return.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-2 font-bold ${trade.isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.isSuccess ? '성공' : '실패'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 