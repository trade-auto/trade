import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { UpbitCandle, CandlestickData } from '../types/candlestick';

interface CsvDownloaderProps {
  csvDateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
  csvLoading: boolean;
  csvProgress: number;
  allData: CandlestickData[] | UpbitCandle[];
  setCsvDateRange: (range: { startDate: Date | null; endDate: Date | null }) => void;
  saveToCSV: () => void;
  isDataImported?: boolean;
  importProgress?: number;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  onFileImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  triggerFileInput?: () => void;
}

const CsvDownloader: React.FC<CsvDownloaderProps> = ({
  csvDateRange,
  csvLoading,
  csvProgress,
  allData,
  setCsvDateRange,
  saveToCSV,
  isDataImported,
  importProgress,
  fileInputRef,
  onFileImport,
  triggerFileInput
}) => {
  // 진행 상태 메시지 생성
  const getProgressMessage = (progress: number) => {
    if (progress < 5) return '데이터 요청 준비 중...';
    if (progress < 10) return '초기 연결 설정 중...';
    if (progress < 20) return '데이터 요청 시작...';
    if (progress < 30) return `초봉 데이터 다운로드 중 (${progress}%)`;
    if (progress < 40) return `첫 번째 배치 처리 중 (${progress}%)`;
    if (progress < 50) return `두 번째 배치 처리 중 (${progress}%)`;
    if (progress < 60) return `세 번째 배치 처리 중 (${progress}%)`;
    if (progress < 70) return `네 번째 배치 처리 중 (${progress}%)`;
    if (progress < 80) return `다섯 번째 배치 처리 중 (${progress}%)`;
    if (progress < 90) return `마지막 배치 처리 중 (${progress}%)`;
    if (progress < 95) return `데이터 정렬 중 (${progress}%)`;
    if (progress < 98) return `CSV 파일 생성 중 (${progress}%)`;
    if (progress < 100) return `다운로드 준비 중 (${progress}%)`;
    return '완료!';
  };

  // 진행 상태에 따른 색상 설정
  const getProgressColor = (progress: number) => {
    if (progress < 10) return 'bg-blue-300';
    if (progress < 20) return 'bg-blue-400';
    if (progress < 30) return 'bg-blue-500';
    if (progress < 40) return 'bg-blue-600';
    if (progress < 50) return 'bg-blue-700';
    if (progress < 60) return 'bg-indigo-400';
    if (progress < 70) return 'bg-indigo-500';
    if (progress < 80) return 'bg-indigo-600';
    if (progress < 90) return 'bg-indigo-700';
    return 'bg-indigo-800';
  };

  // 진행 단계 표시 메시지
  const getStageMessage = (progress: number) => {
    if (progress < 10) return '초기화';
    if (progress < 30) return '데이터 요청';
    if (progress < 60) return '데이터 수집';
    if (progress < 90) return '데이터 처리';
    if (progress < 95) return '데이터 정렬';
    if (progress < 100) return 'CSV 생성';
    return '완료';
  };

  return (
    <div className="mb-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-400 text-sm">CSV 다운로드/임포트</div>
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
              } text-white min-w-[140px]`}
            >
              {csvLoading ? '다운로드 중...' : 'CSV 다운로드'}
            </button>

            {/* CSV 임포트 버튼 */}
            {triggerFileInput && (
              <button
                onClick={triggerFileInput}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
              >
                CSV 파일 임포트
              </button>
            )}
          </div>
        </div>
        
        {/* 진행 상태 표시 */}
        {csvLoading && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div className="text-gray-300 font-medium">{getProgressMessage(csvProgress)}</div>
              <div className="text-gray-400 font-bold">{csvProgress}%</div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div 
                className={`${getProgressColor(csvProgress)} h-3 rounded-full transition-all duration-300 relative`}
                style={{ width: `${csvProgress}%` }}
              >
                {csvProgress > 5 && (
                  <div className="absolute inset-0 animate-pulse opacity-75 bg-white rounded-full"></div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <div>
                {getStageMessage(csvProgress)}
              </div>
              <div>
                {csvProgress < 100 ? 
                  `예상 남은 시간: ${Math.ceil((100 - csvProgress) / 10)}분` : 
                  '다운로드가 곧 시작됩니다.'
                }
              </div>
            </div>
          </div>
        )}

        {/* 임포트 진행 상태 */}
        {isDataImported && importProgress !== undefined && importProgress < 100 && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div className="text-gray-300 font-medium">CSV 파일 임포트 중...</div>
              <div className="text-gray-400 font-bold">{importProgress}%</div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 파일 입력 필드 */}
      {fileInputRef && onFileImport && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileImport}
          accept=".csv"
          className="hidden"
        />
      )}
    </div>
  );
};

export default CsvDownloader; 