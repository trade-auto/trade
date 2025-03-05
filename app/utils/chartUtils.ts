import { 
  IChartApi, 
  ISeriesApi
} from 'lightweight-charts';
import { calculateEMA } from './chartHelpers';
import { ExtendedCandlestickData } from '../types/candlestick';

/**
 * 차트 시리즈 데이터 업데이트 함수
 * @param chartApiRef 차트 API 참조
 * @param candleSeriesRef 캔들 시리즈 참조
 * @param volumeSeriesRef 볼륨 시리즈 참조
 * @param emaSeriesRefs EMA 시리즈 참조 객체
 * @param data 캔들스틱 데이터
 * @param showMA MA 표시 설정
 */
export const updateChartSeries = (
  chartApiRef: React.MutableRefObject<IChartApi | null>,
  candleSeriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  volumeSeriesRef: React.MutableRefObject<ISeriesApi<"Histogram"> | null>,
  emaSeriesRefs: {
    sixtyEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>,
    oneTwentyEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>,
    twoFortyEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>,
    threeHundredSixtyEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>,
    threeHundredEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>,
    nineHundredEMA: React.MutableRefObject<ISeriesApi<"Line"> | null>
  },
  data: ExtendedCandlestickData[],
  showMA: {
    sixty: boolean,
    oneTwenty: boolean,
    twoForty: boolean,
    threeHundredSixty: boolean,
    threeHundred: boolean,
    nineHundred: boolean
  }
) => {
  if (!data || data.length === 0) return;
  
  if (candleSeriesRef.current) {
    // 캔들 데이터 설정
    candleSeriesRef.current.setData(data);
    
    // 볼륨 데이터 설정
    if (volumeSeriesRef.current) {
      const volumeData = data.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a' : '#ef5350',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }
    
    // EMA 계산 및 설정
    const ema60Data = calculateEMA(data, 60);
    const ema120Data = calculateEMA(data, 120);
    const ema240Data = calculateEMA(data, 240);
    const ema360Data = calculateEMA(data, 360);
    const ema300Data = calculateEMA(data, 300);
    const ema900Data = calculateEMA(data, 900);
    
    // 각 EMA 시리즈 업데이트
    if (emaSeriesRefs.sixtyEMA.current && ema60Data && ema60Data.length > 0) {
      emaSeriesRefs.sixtyEMA.current.setData(ema60Data);
      emaSeriesRefs.sixtyEMA.current.applyOptions({ visible: showMA.sixty });
    }
    
    if (emaSeriesRefs.oneTwentyEMA.current && ema120Data && ema120Data.length > 0) {
      emaSeriesRefs.oneTwentyEMA.current.setData(ema120Data);
      emaSeriesRefs.oneTwentyEMA.current.applyOptions({ visible: showMA.oneTwenty });
    }
    
    if (emaSeriesRefs.twoFortyEMA.current && ema240Data && ema240Data.length > 0) {
      emaSeriesRefs.twoFortyEMA.current.setData(ema240Data);
      emaSeriesRefs.twoFortyEMA.current.applyOptions({ visible: showMA.twoForty });
    }
    
    if (emaSeriesRefs.threeHundredSixtyEMA.current && ema360Data && ema360Data.length > 0) {
      emaSeriesRefs.threeHundredSixtyEMA.current.setData(ema360Data);
      emaSeriesRefs.threeHundredSixtyEMA.current.applyOptions({ visible: showMA.threeHundredSixty });
    }
    
    if (emaSeriesRefs.threeHundredEMA.current && ema300Data && ema300Data.length > 0) {
      emaSeriesRefs.threeHundredEMA.current.setData(ema300Data);
      emaSeriesRefs.threeHundredEMA.current.applyOptions({ visible: showMA.threeHundred });
    }
    
    if (emaSeriesRefs.nineHundredEMA.current && ema900Data && ema900Data.length > 0) {
      emaSeriesRefs.nineHundredEMA.current.setData(ema900Data);
      emaSeriesRefs.nineHundredEMA.current.applyOptions({ visible: showMA.nineHundred });
    }
    
    // 타임스케일 피팅
    if (chartApiRef.current) {
      chartApiRef.current.timeScale().fitContent();
    }
  }
}; 