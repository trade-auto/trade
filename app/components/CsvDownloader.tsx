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
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-400 text-sm">CSV 다운로드 기간 설정</div>
          <div className="flex flex-wrap gap-3">
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
                timeIntervals={15}
                timeCaption="시간"
                dateFormat="yyyy-MM-dd HH:mm"
                maxDate={new Date()}
                className="bg-gray-700 text-white px-3 py-2 rounded"
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
                timeIntervals={15}
                timeCaption="시간"
                dateFormat="yyyy-MM-dd HH:mm"
                maxDate={new Date()}
                minDate={csvDateRange.startDate || undefined}
                className="bg-gray-700 text-white px-3 py-2 rounded"
                popperClassName="react-datepicker-popper"
                popperPlacement="right-start"
                withPortal
                placeholderText="종료 날짜 선택"
              />
            </div>
            <button
              onClick={saveToCSV}
              disabled={csvLoading || !allData || allData.length === 0}
              className={`px-4 py-2 rounded-lg font-bold ${
                csvLoading || !allData || allData.length === 0
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {csvLoading ? 'CSV 생성 중...' : 'CSV 다운로드'}
            </button>
          </div>
        </div>
        
        {/* 진행 상태 표시 */}
        {csvLoading && (
          <div>
            <div className="text-gray-400 text-sm mb-2">CSV 생성 중... {csvProgress}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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