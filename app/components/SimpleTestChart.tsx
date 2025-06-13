import React from 'react';

interface SimpleTestChartProps {
  data: any[];
}

const SimpleTestChart: React.FC<SimpleTestChartProps> = ({ data }) => {
  console.log('🔥🔥🔥 SimpleTestChart 렌더링됨!', data.length);
  
  return (
    <div style={{
      background: '#ffeb3b',
      color: '#000',
      padding: '20px',
      margin: '10px 0',
      border: '3px solid #000',
      fontSize: '18px',
      fontWeight: 'bold'
    }}>
      ✅ SimpleTestChart가 성공적으로 렌더링되었습니다!
      <br />
      데이터 개수: {data.length}개
      <br />
      첫 번째 데이터: {JSON.stringify(data[0])}
    </div>
  );
};

export default SimpleTestChart;