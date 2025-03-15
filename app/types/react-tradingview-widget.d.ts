declare module 'react-tradingview-widget' {
  export enum Themes {
    LIGHT = 'Light',
    DARK = 'Dark'
  }

  interface Chart {
    crossHairMoved: (callback: (params: { price: number }) => void) => void;
  }

  interface Widget {
    onChartReady: (callback: () => void) => void;
    activeChart: () => Chart;
  }

  export interface TradingViewWidgetProps {
    symbol?: string;
    theme?: Themes;
    autosize?: boolean;
    interval?: string;
    locale?: string;
    timezone?: string;
    style?: string;
    toolbar_bg?: string;
    enable_publishing?: boolean;
    hide_side_toolbar?: boolean;
    allow_symbol_change?: boolean;
    save_image?: boolean;
    container_id?: string;
    width?: string | number;
    height?: string | number;
  }

  export default function TradingViewWidget(props: TradingViewWidgetProps): JSX.Element;
} 