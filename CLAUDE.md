# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드를 제공합니다.

## 프로젝트 개요

업비트 거래소를 위한 Next.js 기반 암호화폐 트레이딩 플랫폼으로, 실시간 모니터링, 자동화된 트레이딩 전략, 종합적인 백테스팅 기능을 제공합니다.

## 기술 스택
- **프레임워크**: Next.js 15 with App Router
- **언어**: TypeScript
- **상태 관리**: Zustand
- **차트**: Lightweight Charts
- **실시간 데이터**: WebSocket
- **API 클라이언트**: Axios
- **스타일링**: Tailwind CSS + Chakra UI

## 개발 명령어

```bash
# 개발 서버 실행 (포트 3001)
yarn dev

# 프로덕션 빌드
yarn build

# 프로덕션 서버 시작
yarn start

# 린팅 실행
yarn lint
```

## 핵심 아키텍처

### 애플리케이션 구조
Next.js App Router를 사용하며 주요 라우트:
- `/` - 실시간 차트가 있는 메인 대시보드
- `/order` - 주문 생성 및 관리
- `/orders` - 주문 내역 및 열린 주문 보기
- `/account` - 계정 정보
- `/volume-chart` - 거래량 분석

### API 통합 (`/app/api/`)
모든 업비트 API 호출은 서버사이드 API 라우트를 통해 처리:
- **계정**: `/api/accounts` - 계정 잔고 조회
- **마켓 데이터**: 
  - `/api/candles` - 과거 캔들 데이터
  - `/api/ticker` - 실시간 티커 정보
  - `/api/trades` - 최근 거래 내역
- **주문 관리**:
  - `/api/orders/create` - 신규 주문
  - `/api/orders/cancel` - 주문 취소
  - `/api/orders/list`, `/open`, `/closed` - 주문 조회

### 상태 관리 (`/app/store/`)
- **useUpbitStore**: 마켓 데이터, 주문, 거래 상태를 위한 메인 스토어
- **useCoinStore**: 선택된 코인 및 차트 설정 관리

### 차트 컴포넌트 (`/app/components/`)
- **CandlestickChartCore**: 캔들스틱, MA 지표, 거래 신호가 있는 메인 차트
- **MACDChart**: MACD 지표 시각화
- **PolMACDChart**: 커스텀 MACD 변형
- **UpbitVolumeChart**: 거래량 분석 차트
- **ChartContainer**: 차트 생명주기 및 데이터 업데이트 관리

### 트레이딩 전략 (`/app/strategies/`)
자동화된 트레이딩 전략들:
- **maCrossStrategy**: 이동평균선 교차
- **maCrossDeviationStrategy**: MA 교차 + 편차 필터
- **macdStrategy**: MACD 기반 신호
- **slopeFilterStrategy**: MA 기울기 분석

각 전략은 `shouldBuy()`와 `shouldSell()` 메소드를 가진 `TradingStrategy` 인터페이스를 구현합니다.

## 주요 기능
- **실시간 데이터**: WebSocket을 통한 라이브 가격 업데이트
- **기술적 분석**: 다중 MA 기간, MACD, 거래량 분석
- **자동 거래**: 백테스팅이 가능한 설정 가능한 전략
- **주문 관리**: 주문 생성, 취소, 모니터링
- **CSV 가져오기/내보내기**: 과거 데이터 분석 및 전략 테스팅

## 개발 중요사항

### 언어 설정
항상 한국어로 답변하세요.

### WebSocket 관리
실시간 가격 업데이트는 WebSocket 연결을 사용합니다. WebSocket 로직 수정 시 적절한 정리와 재연결 처리를 확인하세요.

### 트레이딩 로직
- 거래 간 최소 간격 (30-60초)
- `tradeState`에서 포지션 관리
- 거래 실행 전 항상 `theoreticalPosition` 확인

### 주문 관리
- 주문은 API 라우트를 통한 적절한 인증 필요
- 항상 주문 실패와 부분 체결 처리
- 거래 전 주문 한도 확인

## 현재 브랜치 정보
작업 브랜치: ripple-temp-034
PR을 위한 메인 브랜치: dev
