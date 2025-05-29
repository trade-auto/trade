# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드를 제공합니다.

## 프로젝트 개요

업비트 거래소를 위한 Next.js 기반 암호화폐 트레이딩 플랫폼으로, 실시간 모니터링, 자동화된 트레이딩 전략, 종합적인 백테스팅 기능을 제공합니다.

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

### 상태 관리
- `/app/store/`의 **Zustand 스토어**:
  - `useUpbitStore`: 가격, 티커, 거래 상태, MA 설정, 전략을 위한 중앙 상태 관리
  - `useCoinStore`: 코인 선택 관리
  
### API 통합
- 모든 업비트 API 호출은 `/app/api/` 라우트를 통해 처리
- 인증은 `upbitAccount.ts`와 `upbitOrder.ts`에서 처리
- WebSocket 연결은 `/app/hooks/useUpbitWebSocket.ts`에서 관리

### 트레이딩 전략
전략들은 모듈화되어 `/app/strategies/`에 위치:
- `maCrossStrategy`: 이동평균선 교차
- `macdStrategy`: MACD 기반 트레이딩
- `maCrossDeviationStrategy`: 볼린저 밴드 유사 접근법
- `slopeFilterStrategy`: A15 기울기 기반 필터링

각 전략은 `shouldBuy()`와 `shouldSell()` 메소드를 가진 `TradingStrategy` 인터페이스를 구현합니다.

### 차트 컴포넌트
핵심 차트 기능은 다음과 같이 분리:
- `CandlestickChartCore`: 메인 차트 컴포넌트
- `CandlestickChartHooks`: 차트 데이터와 CSV 기능을 위한 커스텀 훅
- `CandlestickChartTypes`: TypeScript 타입 정의
- `CandlestickChartUtils`: 유틸리티 함수

### 기술적 지표
- 이동평균선: MA60, MA120, MA240, MA360, MA600
- 커스텀 파라미터를 가진 MACD
- RSI, 스토캐스틱, 볼린저 밴드
- `/app/indicators/`의 커스텀 PolMACD 지표

## 중요한 개발 참고사항

### 언어 설정
항상 한국어로 답변하세요 (Cursor 규칙에 따라).

### WebSocket 관리
실시간 가격 업데이트는 WebSocket 연결을 사용합니다. WebSocket 로직 수정 시 적절한 정리와 재연결 처리를 확인하세요.

### 트레이딩 로직
- 거래 간 최소 간격 (30-60초)
- `tradeState`에서 포지션 관리
- 거래 실행 전 항상 `theoreticalPosition` 확인

### CSV 가져오기/내보내기
백테스팅은 CSV 데이터를 사용합니다. 형식은 timestamp, open, high, low, close, volume 컬럼을 포함한 예상 구조와 일치해야 합니다.

### 주문 관리
- 주문은 API 라우트를 통한 적절한 인증 필요
- 항상 주문 실패와 부분 체결 처리
- 거래 전 주문 한도 확인

## 현재 브랜치 정보
작업 브랜치: 리플&온도0.34
PR을 위한 메인 브랜치: dev