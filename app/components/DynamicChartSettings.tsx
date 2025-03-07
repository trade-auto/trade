'use client';

import dynamic from 'next/dynamic';
import { MASettings } from '../types/candlestick';

const ChartSettings = dynamic(() => import('./ChartSettings'), {
  ssr: false,
});

interface ChartSettingsProps {
  showMA: MASettings;
  updateShowMA: (newShowMA: MASettings) => void;
  chartHeight: number;
  handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DynamicChartSettings({
  showMA,
  updateShowMA,
  chartHeight,
  handleHeightChange,
}: ChartSettingsProps) {
  return (
    <ChartSettings
      showMA={showMA}
      updateShowMA={updateShowMA}
      chartHeight={chartHeight}
      handleHeightChange={handleHeightChange}
    />
  );
} 