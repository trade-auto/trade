import { TradingStrategy } from './types';
import macdStrategy from './macdStrategy';
import maCrossStrategy from './maCrossStrategy';
import maCrossDeviationStrategy from './maCrossDeviationStrategy';
import slopeFilterStrategy from './slopeFilterStrategy';
import bollingerStrategy from './bollingerStrategy';

// 모든 전략을 하나의 객체로 내보냅니다
const strategies: Record<string, TradingStrategy> = {
  MACD: macdStrategy as TradingStrategy,
  MA_CROSS: maCrossStrategy,
  MA_CROSS_DEVIATION: maCrossDeviationStrategy,
  SLOPE_FILTER: slopeFilterStrategy,
  BOLLINGER: bollingerStrategy as TradingStrategy
};

export default strategies;

// 개별 전략도 내보냅니다
export {
  macdStrategy,
  maCrossStrategy,
  maCrossDeviationStrategy,
  slopeFilterStrategy,
  bollingerStrategy
}; 