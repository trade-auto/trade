import { TradingStrategy } from './types';
import bollingerStrategy from './bollingerStrategy';
import maCrossStrategy from './maCrossStrategy';
import maCrossDeviationStrategy from './maCrossDeviationStrategy';
import slopeFilterStrategy from './slopeFilterStrategy';

// 모든 전략을 하나의 객체로 내보냅니다
const strategies: Record<string, TradingStrategy> = {
  BOLLINGER: bollingerStrategy as TradingStrategy,
  MA_CROSS: maCrossStrategy,
  MA_CROSS_DEVIATION: maCrossDeviationStrategy,
  SLOPE_FILTER: slopeFilterStrategy
};

export default strategies;

// 개별 전략도 내보냅니다
export {
  bollingerStrategy,
  maCrossStrategy,
  maCrossDeviationStrategy,
  slopeFilterStrategy
}; 