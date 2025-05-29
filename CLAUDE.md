# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a cryptocurrency trading monitoring and automation platform built for the Upbit exchange. It provides real-time charting, technical analysis, automated trading strategies, and order management capabilities.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **State Management**: Zustand
- **Charts**: Lightweight Charts
- **Real-time Data**: WebSocket (native and react-websocket)
- **API Client**: Axios
- **Styling**: Tailwind CSS + Chakra UI

## Build Commands
```bash
yarn dev        # Start development server on port 3001
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint
```

## Architecture

### Core Application Structure
The application uses Next.js App Router with the following key routes:
- `/` - Main trading dashboard with real-time charts
- `/order` - Order creation and management
- `/orders` - Order history and open orders view
- `/account` - Account information
- `/volume-chart` - Volume analysis

### API Integration (`/app/api/`)
All Upbit API interactions are handled through server-side API routes to secure API keys:
- **Account**: `/api/accounts` - Get account balances
- **Market Data**: 
  - `/api/candles` - Historical candle data
  - `/api/ticker` - Real-time ticker information
  - `/api/trades` - Recent trade history
- **Order Management**:
  - `/api/orders/create` - Place new orders
  - `/api/orders/cancel` - Cancel orders
  - `/api/orders/list`, `/open`, `/closed` - Order queries
  - `/api/orders/chance` - Check order placement availability

### Component Architecture

#### Chart Components (`/app/components/`)
- **CandlestickChartCore**: Main chart component with candlestick display, MA indicators, and trading signals
- **MACDChart**: MACD indicator visualization
- **PolMACDChart**: Custom MACD variant
- **UpbitVolumeChart**: Volume analysis chart
- **ChartContainer**: Wrapper managing chart lifecycle and data updates
- **ChartControls/ChartSettings**: User interface for chart configuration

#### Trading Components
- **OrderForm/CreateOrder**: Order placement interface
- **OpenOrders/ClosedOrders**: Order management views
- **OrderChanceInfo**: Display available trading limits
- **CoinSelector**: Cryptocurrency pair selection

### State Management (`/app/store/`)
- **useUpbitStore**: Main store for market data, orders, and trading state
- **useCoinStore**: Selected coin and chart preferences
- WebSocket connections and real-time data updates are managed through stores

### Trading Strategies (`/app/strategies/`)
Multiple automated trading strategies are implemented:
- **maCrossStrategy**: Moving average crossover
- **maCrossDeviationStrategy**: MA cross with deviation filters
- **macdStrategy**: MACD-based signals
- **slopeFilterStrategy**: MA slope analysis
Each strategy exports buy/sell signal detection functions used by the chart components.

### Real-time Data Flow
1. WebSocket connection established via `useUpbitWebSocket` hook
2. Real-time ticker/trade data updates Zustand stores
3. Chart components subscribe to store updates
4. Trading strategies analyze data and generate signals
5. Visual indicators and alerts displayed on charts

## Key Features
- **Real-time Data**: WebSocket integration for live price updates
- **Technical Analysis**: Multiple MA periods, MACD, volume analysis
- **Automated Trading**: Configurable strategies with backtesting
- **Order Management**: Create, cancel, and monitor orders
- **CSV Import/Export**: Historical data analysis and strategy testing

## Development Patterns
- API routes handle all exchange communication (security)
- Zustand stores centralize state management
- Components are modular and focused on specific features
- Trading strategies are pure functions for testability
- TypeScript interfaces define data structures throughout

## Configuration
- Upbit API keys must be set in environment variables
- Chart settings and preferences stored in localStorage
- Trading parameters configurable through UI

## Important Considerations
- All monetary values from Upbit API are in KRW (Korean Won)
- WebSocket reconnection logic is built into the hooks
- Rate limiting is handled in API routes
- Order placement requires proper authentication and available balance