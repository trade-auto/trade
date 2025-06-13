# CLAUDE.md

이 파일은 이 저장소의 코드 작업 시 Claude Code (claude.ai/code)에 대한 지침을 제공합니다.

## 프로젝트 개요
업비트 거래소를 위한 암호화폐 거래 모니터링 및 자동화 플랫폼입니다. 실시간 차트, 기술적 분석, 자동 매매 전략, 주문 관리 기능을 제공합니다.

## 기술 스택
- **프레임워크**: Next.js 15 (App Router 사용)
- **언어**: TypeScript
- **상태 관리**: Zustand
- **차트**: Lightweight Charts
- **실시간 데이터**: WebSocket (native 및 react-websocket)
- **API 클라이언트**: Axios
- **스타일링**: Tailwind CSS + Chakra UI

## 빌드 명령어
```bash
yarn dev        # 개발 서버 시작 (포트 3001)
yarn build      # 프로덕션 빌드
yarn start      # 프로덕션 서버 시작
yarn lint       # ESLint 실행
```

## 아키텍처

### 핵심 애플리케이션 구조
Next.js App Router를 사용하며 다음의 주요 라우트를 포함합니다:
- `/` - 실시간 차트가 포함된 메인 트레이딩 대시보드
- `/order` - 주문 생성 및 관리
- `/orders` - 주문 내역 및 미체결 주문 보기
- `/account` - 계정 정보
- `/volume-chart` - 거래량 분석

### API 통합 (`/app/api/`)
모든 업비트 API 상호작용은 API 키 보안을 위해 서버사이드 API 라우트를 통해 처리됩니다:
- **계정**: `/api/accounts` - 계정 잔고 조회
- **시장 데이터**: 
  - `/api/candles` - 과거 캔들 데이터
  - `/api/ticker` - 실시간 시세 정보
  - `/api/trades` - 최근 거래 내역
- **주문 관리**:
  - `/api/orders/create` - 신규 주문
  - `/api/orders/cancel` - 주문 취소
  - `/api/orders/list`, `/open`, `/closed` - 주문 조회
  - `/api/orders/chance` - 주문 가능 정보 확인

### 컴포넌트 아키텍처

#### 차트 컴포넌트 (`/app/components/`)
- **CandlestickChartCore**: 캔들스틱 표시, MA 지표, 매매 신호가 포함된 메인 차트 컴포넌트
**MACDChart**: MACD 지표 시각화 (표준 MACD 12-26-9, RSI, 캔들차트, EMA)
- **PolMACDChart**: EMA-MACD-RSI 추세추종 전략 구현
  - 표준 MACD (12-26-9)
  - EMA: 5, 20, 60, 200 (주요 지표)
  - RSI(14) 하단 25% 영역에 별도 표시
  - ATR(14) 되돌림 계산용
  - 차트 높이: 1600px (상단 65% 캔들차트, 중앙 20% MACD, 하단 25% RSI)
   1. MACD 설정 변경
  - 기존: 23-25-11
  - 변경: 12-26-9 (표준 MACD)

  2. EMA 추가
  - EMA 60 (주황색) ✓
  - EMA 200 (보라색, 굵게) ✓

  3. 매매 신호 로직
  - 200 EMA 상승 추세 확인 ✓
  - 종가 > 200 EMA ✓
  - 20 EMA 근처 되돌림 (±0.25 ATR) ✓
  - MACD 골든크로스 ✓
  - RSI 50→55 상향 돌파 ✓

  4. 조기 청산 조건
  - 5 EMA < 20 EMA 데드크로스 ✓
  - MACD 히스토그램 2봉 연속 음수 ✓
  - RSI ≥ 70 후 첫 음봉 ✓

  5. 백테스트
  - 수수료 0.1% (왕복) 자동 반영 ✓
- **UpbitVolumeChart**: 거래량 분석 차트
- **ChartContainer**: 차트 생명주기 및 데이터 업데이트를 관리하는 래퍼
- **ChartControls/ChartSettings**: 차트 설정을 위한 사용자 인터페이스

#### 트레이딩 컴포넌트
- **OrderForm/CreateOrder**: 주문 생성 인터페이스
- **OpenOrders/ClosedOrders**: 주문 관리 뷰
- **OrderChanceInfo**: 거래 가능 한도 표시
- **CoinSelector**: 암호화폐 페어 선택

### 상태 관리 (`/app/store/`)
- **useUpbitStore**: 시장 데이터, 주문, 거래 상태를 위한 메인 스토어
- **useCoinStore**: 선택된 코인 및 차트 설정
- WebSocket 연결과 실시간 데이터 업데이트는 스토어를 통해 관리됩니다

### 매매 전략 (`/app/strategies/`)
여러 자동 매매 전략이 구현되어 있습니다:
- **maCrossStrategy**: 이동평균선 교차
- **maCrossDeviationStrategy**: 편차 필터가 포함된 MA 교차
- **macdStrategy**: MACD 기반 신호
- **slopeFilterStrategy**: MA 기울기 분석
- **EMA-MACD-RSI 추세추종 전략** (PolMACDChart에 구현):
  - 트렌드 필터: 200 EMA 상승 & 가격 > 200 EMA
  - 진입: 20 EMA 되돌림(±0.25 ATR) + MACD 골든크로스 + RSI 50→55 돌파
  - 청산: 5/20 EMA 데드크로스, MACD 히스토그램 2봉 음전환, RSI ≥70 후 첫 음봉
  - 백테스트: 수수료 0.1% 자동 반영, RR 1.8:1 목표
각 전략은 차트 컴포넌트에서 사용되는 매수/매도 신호 감지 함수를 내보냅니다.

### 실시간 데이터 흐름
1. `useUpbitWebSocket` 훅을 통해 WebSocket 연결 설정
2. 실시간 시세/거래 데이터가 Zustand 스토어 업데이트
3. 차트 컴포넌트가 스토어 업데이트 구독
4. 매매 전략이 데이터를 분석하고 신호 생성
5. 차트에 시각적 지표와 알림 표시

## 주요 기능
- **실시간 데이터**: 실시간 가격 업데이트를 위한 WebSocket 통합
- **기술적 분석**: 다중 MA 기간, MACD, 거래량 분석
- **자동 매매**: 백테스팅이 가능한 설정 가능한 전략
- **주문 관리**: 주문 생성, 취소, 모니터링
- **CSV 가져오기/내보내기**: 과거 데이터 분석 및 전략 테스트

## 개발 패턴
- API 라우트가 모든 거래소 통신 처리 (보안)
- Zustand 스토어가 상태 관리 중앙화
- 컴포넌트는 모듈화되어 특정 기능에 집중
- 매매 전략은 테스트 가능성을 위한 순수 함수
- TypeScript 인터페이스가 전체 데이터 구조 정의

## 설정
- 업비트 API 키는 환경 변수에 설정해야 함
- 차트 설정과 환경설정은 localStorage에 저장
- 거래 매개변수는 UI를 통해 설정 가능

## 중요 고려사항
- 업비트 API의 모든 금액은 KRW(한국 원화) 단위
- WebSocket 재연결 로직이 훅에 내장되어 있음
- API 라우트에서 속도 제한 처리
- 주문 실행은 적절한 인증과 가용 잔고가 필요함