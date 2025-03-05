import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { UpbitCandle } from '../types/candlestick';

interface CsvDownloaderProps {
  csvDateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
  csvLoading: boolean;
  csvProgress: number;
  allData: UpbitCandle[];
  symbol: string;
  chartType: string;
  setCsvDateRange: (range: { startDate: Date | null; endDate: Date | null }) => void;
  saveToCSV: () => void;
}

const CsvDownloader: React.FC<CsvDownloaderProps> = ({
  csvDateRange,
  csvLoading,
  csvProgress,
  allData,
  symbol,
  chartType,
  setCsvDateRange,
  saveToCSV
}) => {
  return (
    <div className="mb-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="text-gray-400 text-sm">CSV 다운로드 기간 설정</div>
          <div className="flex space-x-4">
            <div>
              <DatePicker
                selected={csvDateRange.startDate}
                onChange={(date: Date | null) => {
                  setCsvDateRange({
                    ...csvDateRange,
                    startDate: date
                  });
                }}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={1}
                timeCaption="시간"
                dateFormat="yyyy-MM-dd HH:mm"
                maxDate={new Date()}
                className="bg-gray-700 text-white p-2 rounded"
                popperClassName="react-datepicker-popper"
                popperPlacement="right-start"
                withPortal
                placeholderText="시작 날짜 선택"
              />
            </div>
            <div>
              <DatePicker
                selected={csvDateRange.endDate}
                onChange={(date: Date | null) => {
                  setCsvDateRange({
                    ...csvDateRange,
                    endDate: date
                  });
                }}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={1}
                timeCaption="시간"
                dateFormat="yyyy-MM-dd HH:mm"
                maxDate={new Date()}
                minDate={csvDateRange.startDate || undefined}
                className="bg-gray-700 text-white p-2 rounded"
                popperClassName="react-datepicker-popper"
                popperPlacement="right-start"
                withPortal
                placeholderText="종료 날짜 선택"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={saveToCSV}
                disabled={csvLoading}
                className={`px-4 py-2 rounded-lg font-bold ${
                  csvLoading 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {csvLoading ? `데이터 가져오는 중... ${csvProgress}%` : '데이터 가져오기'}
              </button>
              <button
                onClick={() => {
                  if (allData.length > 0) {
                    const header = 'timestamp,open,high,low,close,volume\n';
                    const csvContent = allData
                      .map(candle => {
                        const kstDate = new Date(candle.candle_date_time_kst);
                        const formattedDate = kstDate.toISOString().replace('T', ' ').slice(0, 19);
                        return `${formattedDate},${candle.opening_price},${candle.high_price},${candle.low_price},${candle.trade_price},${candle.candle_acc_trade_volume}`;
                      })
                      .join('\n');
                    
                    const fullContent = header + csvContent;
                    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const fileName = `${symbol}_${chartType}_${csvDateRange.startDate?.toISOString().slice(0,19)}_${csvDateRange.endDate?.toISOString().slice(0,19)}.csv`;
                    
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', fileName);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } else {
                    alert('먼저 데이터를 가져와주세요.');
                  }
                }}
                disabled={csvLoading || allData.length === 0}
                className={`px-4 py-2 rounded-lg font-bold ${
                  csvLoading || allData.length === 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                CSV 다운로드
              </button>
            </div>
          </div>
        </div>
        {/* 로딩 프로그레스 바 */}
        {csvLoading && (
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${csvProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvDownloader; 