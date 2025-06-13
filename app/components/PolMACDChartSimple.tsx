import React from 'react';

interface PolMACDChartSimpleProps {
  data: any[];
  height?: number;
  showMA?: any;
}

const PolMACDChartSimple: React.FC<PolMACDChartSimpleProps> = ({ data, height = 800, showMA }) => {
  console.log('🔥🔥🔥 PolMACDChartSimple 렌더링됨!', data.length);
  
  try {
    return (
      <div style={{
        background: '#ffeb3b',
        color: '#000',
        padding: '20px',
        margin: '10px 0',
        border: '3px solid red',
        fontSize: '18px',
        fontWeight: 'bold'
      }}>
        ✅ PolMACDChartSimple이 성공적으로 렌더링되었습니다!
        <br />
        데이터 개수: {data.length}개
        <br />
        높이: {height}px
        <br />
        showMA: {showMA ? 'true' : 'false'}
      </div>
    );
  } catch (error) {
    console.error('PolMACDChartSimple 에러:', error);
    return (
      <div style={{
        background: '#ff0000',
        color: '#fff',
        padding: '20px',
        margin: '10px 0',
        border: '3px solid black',
        fontSize: '18px',
        fontWeight: 'bold'
      }}>
        ❌ PolMACDChartSimple 에러 발생: {String(error)}
      </div>
    );
  }
};

export default PolMACDChartSimple;