import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface CandleChartProps {
  market: string;
}

export function CandleChart({ market }: CandleChartProps) {
  const [chartData, setChartData] = useState<any>({
    labels: [],
    datasets: [
      {
        label: '가격',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  });

  useEffect(() => {
    const fetchData = async () => {
      // 여기에 API 호출을 통해 10분 간격의 데이터를 가져오는 로직을 추가합니다.
      // 예시 데이터
      const data = [
        { time: '10:00', price: 100 },
        { time: '10:10', price: 105 },
        { time: '10:20', price: 102 },
        { time: '10:30', price: 108 },
        { time: '10:40', price: 110 },
        { time: '10:50', price: 107 },
        // ...
      ];

      setChartData({
        labels: data.map(d => d.time),
        datasets: [
          {
            label: '가격',
            data: data.map(d => d.price),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
          },
        ],
      });
    };

    fetchData();
  }, [market]);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
  };

  return <div style={{ height: '200px', width: '100%' }}><Bar data={chartData} options={options} /></div>;
} 