# Shrimp Task Manager MCP Server

## 개요
이 디렉토리는 업비트 트레이딩 플랫폼에서 사용하는 Shrimp Task Manager MCP (Model Context Protocol) 서버의 데이터 저장소입니다.

## MCP (Model Context Protocol) 소개
MCP는 AI 어시스턴트가 로컬 서비스 및 도구와 상호작용할 수 있게 해주는 개방형 프로토콜입니다. Claude와 같은 AI 모델이 파일 시스템, 데이터베이스, API 등의 리소스에 안전하게 접근할 수 있도록 합니다.

## Shrimp Task Manager
Shrimp Task Manager는 작업 관리 및 자동화를 위한 MCP 서버입니다. 다음과 같은 기능을 제공합니다:

- 작업 생성 및 관리
- 작업 상태 추적
- 작업 실행 스케줄링
- 결과 저장 및 조회

## 디렉토리 구조
```
/shrimp-data/
  ├── tasks/          # 작업 정의 파일
  ├── results/        # 작업 실행 결과
  ├── logs/           # 실행 로그
  └── config/         # 설정 파일
```

## 설정 파일 위치
MCP 서버 설정은 프로젝트 루트의 `.mcp.json` 파일에 정의되어 있습니다:

```json
{
  "mcpServers": {
    "shrimp-task-manager": {
      "command": "npx",
      "args": ["-y", "@smithery/cli@latest", "run", "@cjo4m06/mcp-shrimp-task-manager"],
      "env": {
        "DATA_DIR": "/mnt/f/200.workspace/trade/shrimp-data",
        "TEMPLATES_USE": "en",
        "ENABLE_GUI": "false"
      }
    }
  }
}
```

## 환경 변수 설명
- `DATA_DIR`: 데이터 저장 디렉토리 경로
- `TEMPLATES_USE`: 템플릿 언어 설정 (en: 영어)
- `ENABLE_GUI`: GUI 인터페이스 활성화 여부

## 사용 방법

### 1. MCP 서버 시작
```bash
# MCP 서버는 Claude 앱에서 자동으로 시작됩니다
# 수동 시작이 필요한 경우:
npx -y @smithery/cli@latest run @cjo4m06/mcp-shrimp-task-manager

# 또는 환경 변수와 함께:
DATA_DIR=/mnt/f/200.workspace/trade/shrimp-data npx -y @smithery/cli@latest run @cjo4m06/mcp-shrimp-task-manager
```

### 2. 작업 생성
작업은 JSON 형식으로 `/tasks/` 디렉토리에 저장됩니다:

```json
{
  "id": "task_001",
  "name": "백테스트 실행",
  "type": "backtest",
  "parameters": {
    "strategy": "MA_CROSS",
    "symbol": "KRW-BTC",
    "period": "2024-01-01 to 2024-12-31"
  },
  "schedule": "daily",
  "status": "pending"
}
```

### 3. 결과 확인
작업 실행 결과는 `/results/` 디렉토리에 저장됩니다.

## 트레이딩 플랫폼과의 통합

### 자동화 가능한 작업들
1. **정기 백테스트**: 전략 성과를 주기적으로 검증
2. **데이터 수집**: 시장 데이터 자동 수집 및 저장
3. **리포트 생성**: 거래 성과 리포트 자동 생성
4. **알림 발송**: 특정 조건 달성 시 알림

### 예제: 일일 백테스트 작업
```json
{
  "id": "daily_backtest",
  "name": "일일 백테스트",
  "type": "backtest",
  "parameters": {
    "strategies": ["MA_CROSS", "MACD", "SLOPE_FILTER"],
    "symbols": ["KRW-BTC", "KRW-ETH", "KRW-XRP"],
    "lookback_days": 30
  },
  "schedule": {
    "type": "cron",
    "expression": "0 2 * * *"  // 매일 새벽 2시
  },
  "output": {
    "format": "csv",
    "destination": "/results/daily/"
  }
}
```

## 보안 고려사항
- 이 디렉토리의 데이터는 민감한 거래 정보를 포함할 수 있습니다
- 적절한 파일 권한 설정을 유지하세요
- 정기적인 백업을 수행하세요
- 로그 파일 크기를 모니터링하여 디스크 공간 관리

## 문제 해결

### MCP 서버가 시작되지 않는 경우
1. Node.js가 설치되어 있는지 확인
2. 경로가 올바른지 확인
3. 권한 문제가 있는지 확인

### 데이터가 저장되지 않는 경우
1. `DATA_DIR` 경로가 존재하는지 확인
2. 쓰기 권한이 있는지 확인
3. 디스크 공간이 충분한지 확인

## 추가 리소스
- [MCP 공식 문서](https://github.com/anthropics/mcp)
- [Shrimp Task Manager 문서](https://github.com/anthropics/shrimp-task-manager)
- [업비트 트레이딩 플랫폼 메인 README](/README.md)