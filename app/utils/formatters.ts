// 포맷팅 관련 유틸리티 함수

// 경과 시간 포맷팅
export const formatElapsedTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${remainingSeconds}초`;
  } else if (minutes > 0) {
    return `${minutes}분 ${remainingSeconds}초`;
  } else {
    return `${remainingSeconds}초`;
  }
};

// 가격 변화 스타일 계산
export const getPriceChangeStyle = (currentPrice: number, prevPrice: number | null) => {
  if (!prevPrice) return 'text-white';
  return currentPrice > prevPrice ? 'text-green-500' : currentPrice < prevPrice ? 'text-red-500' : 'text-white';
};

// 총 수익률 계산
export const calculateTotalProfit = (cycles: { profit: string | null }[] = []) => {
  if (!cycles || cycles.length === 0) return '0.00';

  const totalProfit = cycles.reduce((acc, cycle) => {
    if (cycle.profit) {
      return acc + parseFloat(cycle.profit);
    }
    return acc;
  }, 0);

  return totalProfit.toFixed(2);
}; 