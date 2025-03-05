import pandas as pd
import numpy as np
# 백엔드를 명시적으로 설정 (TkAgg는 대부분의 시스템에서 잘 작동함)
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import tkinter as tk
from tkinter import filedialog
import os

# 파일 선택 대화상자 함수
def select_csv_file():
    root = tk.Tk()
    root.withdraw()  # 기본 tkinter 창 숨기기
    
    # 파일 선택 대화상자 표시
    file_path = filedialog.askopenfilename(
        title="거래 데이터 CSV 파일 선택",
        filetypes=[("CSV 파일", "*.csv"), ("모든 파일", "*.*")],
        initialdir=os.getcwd()  # 현재 작업 디렉토리에서 시작
    )
    
    if not file_path:  # 사용자가 취소한 경우
        print("파일 선택이 취소되었습니다. 기본 파일을 사용합니다.")
        return 'KRW-ETH_seconds_60_2025-03-02T22_19_00_2025-03-03T23_10_00_KST.csv'
    
    print(f"선택된 파일: {file_path}")
    return file_path

# ===== 사용자 설정 =====
# 그래프 표시 설정 (True: 표시, False: 숨김)
SHOW_PRICE = True   # 가격 차트 표시 여부
SHOW_MA60 = True    # MA60 표시 여부
SHOW_MA120 = True   # MA120 표시 여부
SHOW_MA240 = True   # MA240 표시 여부
SHOW_MA300 = False  # MA300 표시 여부
SHOW_MA360 = True   # MA360 표시 여부
SHOW_MA900 = True   # MA900 표시 여부

# MA900 상승 추세 설정
MA900_UPTREND_WINDOW = 5  # MA900 상승 추세 확인 기간 (분)
MA900_UPTREND_MIN_SLOPE = 0.00001  # 최소 기울기 (0.005%) - 값 낮춤

# 이동평균선 기울기 및 이격도 설정
MA_SLOPE_WINDOW = 10  # 기울기 계산 기간 (초)
MA_SELL_SLOPE_THRESHOLD = -2  # 매도 기울기 임계값 (도)
MA_BUY_SLOPE_THRESHOLD = 5    # 매수 기울기 임계값 (도)
MA_DEVIATION_THRESHOLD = 0.0008  # 이격도 임계값 (0.08%)

# 매매 설정
INITIAL_CAPITAL = 10000  # 초기 자본금
FEE_RATE = 0.0005        # 매수/매도 수수료 (0.05%)
MIN_PROFIT_PCT = 0.003   # 최소 수익률 (0.3%)
MIN_HOLD_PERIODS = 10    # 최소 보유 기간 (분)
MAX_HOLD_PERIODS = 600   # 최대 보유 기간 (분)
# ======================

# 한글 폰트 설정 (Windows 기준)
try:
    # 맑은 고딕 폰트 사용
    font_path = 'C:/Windows/Fonts/malgun.ttf'
    font_prop = fm.FontProperties(fname=font_path)
    plt.rcParams['font.family'] = font_prop.get_name()
    plt.rcParams['axes.unicode_minus'] = False  # 마이너스 기호 깨짐 방지
    print("한글 폰트 설정 완료")
except:
    print("한글 폰트 설정 실패 - 영문으로 표시됩니다.")
    # 영문 폰트로 대체
    plt.rcParams['font.family'] = 'DejaVu Sans'

# 파일 선택 대화상자에서 선택한 파일 경로 또는 기본 파일 경로
file_path = select_csv_file()

# 데이터 로드
try:
    print(f"파일 로드 시작: {file_path}")
    
    # 파일 존재 여부 확인
    if not os.path.exists(file_path):
        print(f"오류: 파일이 존재하지 않습니다. 경로: {file_path}")
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
    
    # 파일 크기 확인
    file_size = os.path.getsize(file_path)
    print(f"파일 크기: {file_size} 바이트")
    
    if file_size == 0:
        print("오류: 파일이 비어 있습니다.")
        raise ValueError("파일이 비어 있습니다.")
    
    # 파일 내용 미리보기 (처음 5줄)
    print("파일 내용 미리보기:")
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i < 5:
                print(f"  {i+1}: {line.strip()}")
            else:
                break
    
    # pandas로 CSV 파일 로드
    print("pandas로 CSV 파일 로드 시작...")
    df = pd.read_csv(file_path)
    
    print(f"CSV 로드 완료. 컬럼: {df.columns.tolist()}")
    print(f"데이터 형태: {df.shape} (행, 열)")
    
    # 타임스탬프 컬럼 처리
    if 'timestamp(KST)' in df.columns:
        print("'timestamp(KST)' 컬럼을 타임스탬프로 사용합니다.")
        df['timestamp'] = pd.to_datetime(df['timestamp(KST)'])
    elif 'timestamp' in df.columns:
        print("'timestamp' 컬럼을 타임스탬프로 사용합니다.")
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    else:
        # 첫 번째 컬럼을 타임스탬프로 가정
        first_col = df.columns[0]
        print(f"타임스탬프 컬럼이 명시적으로 없습니다. 첫 번째 컬럼 '{first_col}'을 타임스탬프로 사용합니다.")
        df['timestamp'] = pd.to_datetime(df.iloc[:, 0])
    
    # 인덱스 설정
    print("타임스탬프를 인덱스로 설정합니다.")
    df = df.set_index('timestamp')
    
    # 가격 데이터 컬럼 설정 (close 가격 사용)
    if 'close' in df.columns:
        print("'close' 컬럼을 가격 데이터로 사용합니다.")
        df['price'] = df['close']
    elif 'price' in df.columns:
        print("'price' 컬럼이 이미 있습니다.")
        pass  # 이미 price 컬럼이 있음
    else:
        # 숫자 데이터가 있는 첫 번째 컬럼을 가격으로 가정
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                df['price'] = df[col]
                print(f"'{col}' 컬럼을 가격 데이터로 사용합니다.")
                break
    
    # 데이터 유효성 검사
    if 'price' not in df.columns:
        print("오류: 가격 데이터를 찾을 수 없습니다.")
        raise ValueError("가격 데이터를 찾을 수 없습니다.")
    
    # 결측치 확인
    missing_values = df['price'].isna().sum()
    if missing_values > 0:
        print(f"경고: 가격 데이터에 {missing_values}개의 결측치가 있습니다.")
        print("결측치를 제거합니다.")
        df = df.dropna(subset=['price'])
    
    # 시간 간격 확인
    print("\n시간 간격 확인 중...")
    if len(df) > 1:
        time_diffs = df.index.to_series().diff().dropna()
        
        # 가장 흔한 시간 간격 찾기 (초 단위)
        most_common_diff = time_diffs.dt.total_seconds().mode().iloc[0]
        print(f"가장 흔한 시간 간격: {most_common_diff}초")
        
        # 불규칙한 간격 확인
        irregular_intervals = time_diffs[time_diffs.dt.total_seconds() != most_common_diff]
        if len(irregular_intervals) > 0:
            print(f"경고: {len(irregular_intervals)}개의 불규칙한 시간 간격이 발견되었습니다.")
            print("불규칙한 간격의 예:")
            for i, (idx, diff) in enumerate(irregular_intervals.items()):
                if i < 5:  # 처음 5개만 출력
                    print(f"  {idx}: {diff.total_seconds()}초")
                else:
                    print(f"  ... 외 {len(irregular_intervals) - 5}개")
                    break
            
            # 데이터 간격이 불규칙한 경우 처리 방법
            print("\n데이터 간격이 불규칙합니다. 다음 중 하나를 선택하세요:")
            print("1. 원본 데이터 그대로 사용 (불규칙한 간격 유지)")
            print("2. 리샘플링하여 규칙적인 간격으로 만들기")
            
            # 여기서는 기본적으로 원본 데이터를 사용하지만, 
            # 필요하다면 사용자 입력을 받아 처리할 수 있습니다.
            choice = 1  # 기본값: 원본 데이터 사용
            
            if choice == 2:
                # 리샘플링 수행
                freq = f"{int(most_common_diff)}S"  # 초 단위 빈도
                print(f"{freq} 간격으로 리샘플링합니다...")
                df = df.resample(freq).mean().interpolate(method='linear')
                print(f"리샘플링 후 데이터 크기: {len(df)} 행")
        else:
            print("모든 시간 간격이 일정합니다.")
    
    print(f"데이터 로드 완료: {len(df)} 행")
    
    # 데이터 미리보기
    print("\n데이터 미리보기:")
    print(df.head())
    
except Exception as e:
    print(f"데이터 로드 중 오류 발생: {e}")
    print("기본 파일을 사용합니다.")
    df = pd.read_csv('KRW-ETH_seconds_60_2025-03-02T22_19_00_2025-03-03T23_10_00_KST.csv')
    df['timestamp'] = pd.to_datetime(df['timestamp(KST)'])
    df = df.set_index('timestamp')
    df['price'] = df['close']

# 초기 설정
initial_capital = INITIAL_CAPITAL
capital = initial_capital
position = 0
fee_rate = FEE_RATE  # 매수/매도 수수료 0.05%
trade_log = []
min_profit_pct = MIN_PROFIT_PCT  # 최소 수익률 0.3% (수수료의 3배)
min_hold_periods = MIN_HOLD_PERIODS  # 최소 보유 기간 (10분)
max_hold_periods = MAX_HOLD_PERIODS  # 최대 보유 기간 (600분)
trade_log = []

# ---------------------------
# 3ea 전략 관련 지표 함수
# ---------------------------
def compute_RSI(prices, window=14):
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=window, min_periods=window).mean()
    avg_loss = loss.rolling(window=window, min_periods=window).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def compute_MACD(prices, fast=12, slow=26, signal=9):
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    macd_signal = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, macd_signal

def compute_Bollinger(prices, window=20, num_std=2):
    sma = prices.rolling(window=window, min_periods=window).mean()
    std = prices.rolling(window=window, min_periods=window).std()
    upper_band = sma + num_std * std
    lower_band = sma - num_std * std
    return sma, upper_band, lower_band

# 추가 지표: 가격 모멘텀 계산
def compute_momentum(prices, period=10):
    return prices.pct_change(periods=period)

# 추가 지표: 급등 감지 함수
def detect_surge(prices, volume=None, window=5, threshold=0.003):  # 임계값 낮춤 (0.005 -> 0.003)
    """
    급등 감지 함수
    - window: 확인할 기간 (분)
    - threshold: 급등 기준 (0.3% = 0.003)
    - volume: 거래량 데이터 (있는 경우 거래량 증가도 확인)
    """
    # 가격 변화율 계산
    pct_change = prices.pct_change(periods=window)
    
    # 급등 조건: 가격이 threshold 이상 상승
    surge = pct_change > threshold
    
    # 거래량 데이터가 있는 경우, 거래량 증가도 확인
    if volume is not None:
        # 거래량 변화율 계산
        vol_change = volume.rolling(window=window).mean() / volume.rolling(window=window*3).mean() - 1
        # 거래량 증가 조건: 평균 거래량이 20% 이상 증가
        vol_surge = vol_change > 0.2
        # 가격 상승과 거래량 증가가 동시에 발생할 때 급등으로 판단
        surge = surge & vol_surge
    
    return surge

# 추가 지표: 이평선 역전 및 기울기를 활용한 급등 감지 함수
def detect_ma_reversal_surge(prices, short_window=3, mid_window=10, long_window=20, slope_threshold=0.0008):  # 임계값 조정 (0.001 -> 0.0008)
    """
    이평선 역전 및 기울기를 활용한 급등 감지 함수
    - short_window: 단기 이평선 기간
    - mid_window: 중기 이평선 기간
    - long_window: 장기 이평선 기간
    - slope_threshold: 기울기 임계값 (0.08% = 0.0008)
    """
    # 이동평균 계산
    short_ma = prices.rolling(window=short_window).mean()
    mid_ma = prices.rolling(window=mid_window).mean()
    long_ma = prices.rolling(window=long_window).mean()
    
    # 이평선 기울기 계산 (현재값과 n분 전 값의 차이를 현재값으로 나눈 비율)
    short_slope = (short_ma - short_ma.shift(2)) / short_ma  # 기간 단축 (3 -> 2)
    mid_slope = (mid_ma - mid_ma.shift(2)) / mid_ma  # 기간 단축 (3 -> 2)
    long_slope = (long_ma - long_ma.shift(2)) / long_ma  # 기간 단축 (3 -> 2)
    
    # 이평선 역전 조건: 단기 > 중기 > 장기
    ma_reversal = (short_ma > mid_ma) & (mid_ma > long_ma)
    
    # 기울기 조건: 모든 이평선의 기울기가 양수이고, 단기 기울기가 임계값 이상
    slope_condition = (short_slope > slope_threshold) & (mid_slope > 0) & (long_slope > 0)
    
    # 추가 확인 조건: 현재 가격이 단기 이평선보다 높음 (상승 추세 확인)
    price_above_ma = prices > short_ma
    
    # 이평선 역전과 기울기 조건이 모두 만족하고, 추가 확인 조건도 만족할 때 급등으로 판단
    ma_surge = ma_reversal & slope_condition & price_above_ma
    
    return ma_surge

# 추가: MA900 상승 추세 확인 함수
def is_ma900_uptrend(ma900_series, window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE):
    """
    MA900 이동평균선이 상승 추세인지 확인하는 함수
    - ma900_series: MA900 시리즈 데이터
    - window: 확인할 기간 (분)
    - min_slope: 최소 기울기 (0.005% = 0.00005)
    """
    if len(ma900_series) < window + 1:
        return False
    
    # 현재 MA900 값과 window 기간 전 값 비교
    current_ma900 = ma900_series.iloc[-1]
    
    # 이전 값이 존재하는지 확인
    if len(ma900_series) <= window:
        prev_ma900 = ma900_series.iloc[0]
    else:
        prev_ma900 = ma900_series.iloc[-window-1]
    
    # 기울기 계산 (현재값과 이전값의 차이를 이전값으로 나눈 비율)
    if prev_ma900 > 0:  # 0으로 나누기 방지
        slope = (current_ma900 - prev_ma900) / prev_ma900
    else:
        slope = 0
    
    # nan 값 처리 추가
    if np.isnan(slope):
        slope = 0
    
    # 디버깅용 출력
    print(f"MA900 확인: 현재={current_ma900}, {window}분 전={prev_ma900}, 기울기={slope:.6f}, 임계값={min_slope}")
    
    # 상승 추세 여부 (현재 값이 이전 값보다 크고, 기울기가 최소 기울기 이상)
    return current_ma900 > prev_ma900 and slope >= min_slope

# 추가: MA300 상승 추세 확인 함수
def is_ma300_uptrend(ma300_series, window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE):
    """
    MA300 이동평균선이 상승 추세인지 확인하는 함수
    - ma300_series: MA300 시리즈 데이터
    - window: 확인할 기간 (분)
    - min_slope: 최소 기울기 (0.005% = 0.00005)
    """
    if len(ma300_series) < window + 1:
        return False
    
    # 현재 MA300 값과 window 기간 전 값 비교
    current_ma300 = ma300_series.iloc[-1]
    
    # 이전 값이 존재하는지 확인
    if len(ma300_series) <= window:
        prev_ma300 = ma300_series.iloc[0]
    else:
        prev_ma300 = ma300_series.iloc[-window-1]
    
    # 기울기 계산 (현재값과 이전값의 차이를 이전값으로 나눈 비율)
    if prev_ma300 > 0:  # 0으로 나누기 방지
        slope = (current_ma300 - prev_ma300) / prev_ma300
    else:
        slope = 0
    
    # nan 값 처리 추가
    if np.isnan(slope):
        slope = 0
    
    # 디버깅용 출력
    print(f"MA300 확인: 현재={current_ma300}, {window}분 전={prev_ma300}, 기울기={slope:.6f}, 임계값={min_slope}")
    
    # 상승 추세 여부 (현재 값이 이전 값보다 크고, 기울기가 최소 기울기 이상)
    return current_ma300 > prev_ma300 and slope >= min_slope

# 추가: MA900 하강 추세 확인 함수
def is_ma900_downtrend(ma900_series, window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE):
    """
    MA900 이동평균선이 하강 추세인지 확인하는 함수
    - ma900_series: MA900 시리즈 데이터
    - window: 확인할 기간 (분)
    - min_slope: 최소 기울기 (0.005% = 0.00005)
    """
    if len(ma900_series) < window + 1:
        return False
    
    # 현재 MA900 값과 window 기간 전 값 비교
    current_ma900 = ma900_series.iloc[-1]
    
    # 이전 값이 존재하는지 확인
    if len(ma900_series) <= window:
        prev_ma900 = ma900_series.iloc[0]
    else:
        prev_ma900 = ma900_series.iloc[-window-1]
    
    # 기울기 계산 (현재값과 이전값의 차이를 이전값으로 나눈 비율)
    if prev_ma900 > 0:  # 0으로 나누기 방지
        slope = (current_ma900 - prev_ma900) / prev_ma900
    else:
        slope = 0
    
    # nan 값 처리 추가
    if np.isnan(slope):
        slope = 0
    
    # 디버깅용 출력
    print(f"MA900 하강 확인: 현재={current_ma900}, {window}분 전={prev_ma900}, 기울기={slope:.6f}")
    
    # 하강 추세 여부 (현재 값이 이전 값보다 작고, 기울기가 음수)
    return current_ma900 < prev_ma900 and slope < 0

# 추가: MA300 하강 추세 확인 함수
def is_ma300_downtrend(ma300_series, window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE):
    """
    MA300 이동평균선이 하강 추세인지 확인하는 함수
    - ma300_series: MA300 시리즈 데이터
    - window: 확인할 기간 (분)
    - min_slope: 최소 기울기 (0.005% = 0.00005)
    """
    if len(ma300_series) < window + 1:
        return False
    
    # 현재 MA300 값과 window 기간 전 값 비교
    current_ma300 = ma300_series.iloc[-1]
    
    # 이전 값이 존재하는지 확인
    if len(ma300_series) <= window:
        prev_ma300 = ma300_series.iloc[0]
    else:
        prev_ma300 = ma300_series.iloc[-window-1]
    
    # 기울기 계산 (현재값과 이전값의 차이를 이전값으로 나눈 비율)
    if prev_ma300 > 0:  # 0으로 나누기 방지
        slope = (current_ma300 - prev_ma300) / prev_ma300
    else:
        slope = 0
    
    # nan 값 처리 추가
    if np.isnan(slope):
        slope = 0
    
    # 디버깅용 출력
    print(f"MA300 하강 확인: 현재={current_ma300}, {window}분 전={prev_ma300}, 기울기={slope:.6f}")
    
    # 하강 추세 여부 (현재 값이 이전 값보다 작고, 기울기가 음수)
    return current_ma300 < prev_ma300 and slope < 0

# ---------------------------
# 6ea 초봉 전략: 리샘플링 및 이동평균 계산 함수
# ---------------------------
def get_ma(series, period, window=3):
    resampled = series.resample(f'{period}s').last()  # 's'로 수정 (대문자 'S' 대신)
    ma = resampled.rolling(window=window, min_periods=1).mean()
    return ma

ma60  = get_ma(df['price'], 60)
ma120 = get_ma(df['price'], 120)
ma240 = get_ma(df['price'], 240)
ma300 = get_ma(df['price'], 300)
ma360 = get_ma(df['price'], 360)
ma900 = get_ma(df['price'], 900)

# ---------------------------
# 강화학습(Q-learning) 관련 설정
# 상태 정의: (RSI_state, MACD_state, uptrend_6ea, momentum_state, surge_state)
#   - RSI_state: 0 (과매도, <25), 1 (중간, 25~70), 2 (과매수, >70)
#   - MACD_state: 1이면 bullish (크로스 발생), 0이면 아니면
#   - uptrend_6ea: 1이면 6ea 이동평균 uptrend, 0이면 아니면
#   - momentum_state: 0 (하락), 1 (상승)
#   - surge_state: 1이면 급등 중, 0이면 아니면
# 행동: 0 = HOLD, 1 = BUY, 2 = SELL
# ---------------------------
def get_state(current_rsi, macd_bullish, uptrend_6ea, momentum, surge):
    if current_rsi < 25:  # 과매도 기준 강화 (30 -> 25)
        rsi_state = 0
    elif current_rsi > 70:  # 과매수 기준 유지
        rsi_state = 2
    else:
        rsi_state = 1
    macd_state = 1 if macd_bullish else 0
    uptrend_state = 1 if uptrend_6ea else 0
    momentum_state = 1 if momentum > 0 else 0
    surge_state = 1 if surge else 0
    return (rsi_state, macd_state, uptrend_state, momentum_state, surge_state)

actions = [0, 1, 2]  # 0: HOLD, 1: BUY, 2: SELL

# Q-table 초기화: 가능한 모든 상태에 대해 3개 행동의 Q값 0으로 초기화
# 단, HOLD에 약간의 편향을 주어 보수적인 거래를 유도
Q = {}
for rsi in [0,1,2]:
    for macd in [0,1]:
        for up in [0,1]:
            for mom in [0,1]:
                for surge in [0,1]:
                    # HOLD(0)에 약간의 편향 부여
                    Q[(rsi, macd, up, mom, surge)] = np.array([0.1, 0.0, 0.0])  # [HOLD, BUY, SELL]
                    
                    # 과매도(RSI<25) 상태에서는 BUY에 편향 부여
                    if rsi == 0 and macd == 1 and up == 1:
                        Q[(rsi, macd, up, mom, surge)] = np.array([0.0, 0.2, 0.0])  # [HOLD, BUY, SELL]
                    
                    # 급등 상태에서는 BUY에 편향 부여
                    if surge == 1 and mom == 1:
                        Q[(rsi, macd, up, mom, surge)] = np.array([0.0, 0.3, 0.0])  # [HOLD, BUY, SELL]
                    
                    # 과매수(RSI>70) 상태에서는 SELL에 편향 부여
                    if rsi == 2:
                        Q[(rsi, macd, up, mom, surge)] = np.array([0.0, 0.0, 0.2])  # [HOLD, BUY, SELL]

alpha = 0.2   # 학습률
gamma = 0.95  # 할인 계수
epsilon = 0.03 # 탐색 확률 감소 (0.05 -> 0.03)

def choose_action(state):
    if np.random.rand() < epsilon:
        return np.random.choice(actions)
    else:
        return np.argmax(Q[state])

# 보상 계산을 위한 net worth 함수
def net_worth(capital, position, price):
    return capital if position == 0 else position * price

prev_net_worth = initial_capital

# MACD 크로스 감지를 위한 이전 값 저장
prev_macd_line = None
prev_macd_signal = None

# 매수 가격 추적
buy_price = 0
buy_time = None  # 매수 시간 추적

# 연속 손실 거래 카운트
consecutive_losses = 0
max_consecutive_losses = 3  # 최대 연속 손실 허용 횟수

# 이전 상태 저장
prev_state = None

# 추가: 이동평균선 기울기 계산 함수 (각도 단위)
def calculate_ma_slope(ma_series, window=MA_SLOPE_WINDOW):
    """
    이동평균선의 기울기를 계산하는 함수 (각도 단위)
    - ma_series: 이동평균선 시리즈 데이터
    - window: 기울기 계산 기간 (초)
    - 반환값: 기울기 (도 단위, 양수는 상승, 음수는 하락)
    """
    if len(ma_series) < window + 1:
        return 0
    
    # 현재 값과 window 기간 전 값
    current_ma = ma_series.iloc[-1]
    prev_ma = ma_series.iloc[-window-1]
    
    # 기울기 계산 (y 변화량 / x 변화량)
    # x 변화량은 시간(초), y 변화량은 가격
    y_change = current_ma - prev_ma
    x_change = window  # 초 단위
    
    # 기울기를 라디안으로 계산 후 도(degree)로 변환
    if x_change != 0:
        # 기울기를 정규화하여 각도 계산 (가격 단위가 크므로 정규화 필요)
        normalized_y_change = y_change / current_ma * 100  # 퍼센트 변화율로 정규화
        slope_rad = np.arctan2(normalized_y_change, x_change)
        slope_deg = np.degrees(slope_rad)
        
        # nan 값 처리 추가
        if np.isnan(slope_deg):
            return 0
        
        return slope_deg
    else:
        return 0

# 추가: 이동평균선 간 이격도 계산 함수
def calculate_ma_deviation(ma1, ma2):
    """
    두 이동평균선 간의 이격도를 계산하는 함수
    - ma1, ma2: 비교할 이동평균선 값
    - 반환값: 이격도 (백분율, 예: 0.01 = 1%)
    """
    if ma2 == 0:
        return 0
    
    # 이격도 = (MA1 - MA2) / MA2
    deviation = (ma1 - ma2) / ma2
    return deviation

# ---------------------------
# 시뮬레이션 루프 (실시간 데이터처럼 순차 처리)
# ---------------------------
for current_time, row in df.iterrows():
    hist = df.loc[:current_time]
    price_series = hist['price']
    if len(price_series) < 20:
        continue
    current_price = row['price']
    
    # 3ea 지표 계산
    rsi_series = compute_RSI(price_series, window=14)
    current_rsi = rsi_series.iloc[-1]
    
    macd_line_series, macd_signal_series = compute_MACD(price_series)
    current_macd_line = macd_line_series.iloc[-1]
    current_macd_signal = macd_signal_series.iloc[-1]
    
    sma_series, upper_band_series, lower_band_series = compute_Bollinger(price_series, window=20, num_std=2)
    current_lower_band = lower_band_series.iloc[-1]
    current_upper_band = upper_band_series.iloc[-1]
    
    # MACD bullish 여부 (이전 값과 비교)
    macd_bullish = False
    if prev_macd_line is not None and prev_macd_signal is not None:
        if (prev_macd_line < prev_macd_signal) and (current_macd_line > current_macd_signal):
            macd_bullish = True

    # 모멘텀 계산
    momentum_series = compute_momentum(price_series, period=10)
    current_momentum = momentum_series.iloc[-1] if not pd.isna(momentum_series.iloc[-1]) else 0
    
    # 급등 감지
    surge_series = detect_surge(price_series, window=5, threshold=0.003)  # 임계값 낮춤 (0.005 -> 0.003)
    current_surge = surge_series.iloc[-1] if not pd.isna(surge_series.iloc[-1]) else False
    
    # 이평선 역전 및 기울기를 활용한 급등 감지
    ma_surge_series = detect_ma_reversal_surge(price_series, short_window=3, mid_window=10, long_window=20, slope_threshold=0.0008)  # 임계값 조정 (0.001 -> 0.0008)
    current_ma_surge = ma_surge_series.iloc[-1] if not pd.isna(ma_surge_series.iloc[-1]) else False
    
    # 두 가지 급등 감지 방법 중 하나라도 급등으로 판단되면 급등으로 간주
    current_surge_combined = current_surge or current_ma_surge
    
    # 6ea 전략: 각 초봉 이동평균 asof로 최신 값 취득
    current_ma60  = ma60.asof(current_time) if not pd.isna(ma60.asof(current_time)) else current_price
    current_ma120 = ma120.asof(current_time) if not pd.isna(ma120.asof(current_time)) else current_price
    current_ma240 = ma240.asof(current_time) if not pd.isna(ma240.asof(current_time)) else current_price
    current_ma300 = ma300.asof(current_time) if not pd.isna(ma300.asof(current_time)) else current_price
    current_ma360 = ma360.asof(current_time) if not pd.isna(ma360.asof(current_time)) else current_price
    current_ma900 = ma900.asof(current_time) if not pd.isna(ma900.asof(current_time)) else current_price
    
    # 10초 전 이동평균 값 가져오기 (매도 조건용)
    prev_time = current_time - pd.Timedelta(seconds=MA_SLOPE_WINDOW)
    prev_ma60 = ma60.asof(prev_time) if prev_time in ma60.index else current_ma60
    prev_ma120 = ma120.asof(prev_time) if prev_time in ma120.index else current_ma120
    prev_ma240 = ma240.asof(prev_time) if prev_time in ma240.index else current_ma240
    prev_ma360 = ma360.asof(prev_time) if prev_time in ma360.index else current_ma360
    
    # 이동평균선 기울기 계산
    ma60_slope = calculate_ma_slope(ma60.loc[:current_time])
    ma120_slope = calculate_ma_slope(ma120.loc[:current_time])
    ma240_slope = calculate_ma_slope(ma240.loc[:current_time])
    ma360_slope = calculate_ma_slope(ma360.loc[:current_time])
    
    # 이동평균선 간 이격도 계산
    ma120_240_deviation = calculate_ma_deviation(current_ma120, current_ma240)
    ma120_240_prev_deviation = calculate_ma_deviation(prev_ma120, prev_ma240)
    ma240_360_deviation = calculate_ma_deviation(current_ma240, current_ma360)
    
    # 이동평균선 돌파 여부 확인
    ma60_above_ma120 = current_ma60 > current_ma120
    ma60_above_ma120_prev = prev_ma60 > prev_ma120
    ma60_cross_up_ma120 = (not ma60_above_ma120_prev) and ma60_above_ma120  # 60MA가 120MA를 상방 돌파
    ma60_cross_down_ma120 = ma60_above_ma120_prev and (not ma60_above_ma120)  # 60MA가 120MA를 하방 돌파
    
    # 역배열 상태 확인 (360MA > 240MA > 120MA)
    reverse_ma_alignment = (current_ma360 > current_ma240 > current_ma120)
    
    # MA900 상승 추세 확인
    ma900_uptrend = is_ma900_uptrend(ma900.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
    
    uptrend_6ea = (current_ma60 > current_ma120 > current_ma240 > current_ma300 > current_ma360 > current_ma900)
    
    # 강화학습 에이전트를 위한 상태 생성
    state = get_state(current_rsi, macd_bullish, uptrend_6ea, current_momentum, current_surge_combined)
    
    # 에이전트가 행동 선택 (epsilon-greedy)
    action = choose_action(state)
    
    # 0: HOLD, 1: BUY (단, 포지션 없을 때), 2: SELL (단, 보유 중일 때)
    if action == 1 and position == 0:
        # MA900과 MA360 하강 추세 확인
        ma900_downtrend = is_ma900_downtrend(ma900.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
        ma360_slope = calculate_ma_slope(ma360.loc[:current_time])
        ma900_slope = calculate_ma_slope(ma900.loc[:current_time])
        
        # 새로운 매수 조건:
        # 1. 초기 매수: 역배열 상태에서 60MA가 상방 전환하여 120MA를 통과
        # 2. 재매수 조건: 60MA가 120MA를 상방 돌파하고, 120MA와 240MA의 기울기가 5도 이상 상향,
        #    360MA와 240MA의 이격도가 0.08% 이상
        
        # 매수 제한: 360MA, 240MA, 120MA가 역배열인 경우는 매수하지 않음
        # 추가 매수 제한: MA900이나 MA360이 하강 추세인 경우 매수하지 않음
        if ma900_downtrend:
            print(f"{current_time} - 매수 신호 발생했으나 MA900 하강 추세로 매수 보류, MA900 기울기: {ma900_slope:.6f}")
        elif ma360_slope < 0:
            print(f"{current_time} - 매수 신호 발생했으나 MA360 하강 추세로 매수 보류, MA360 기울기: {ma360_slope:.6f}")
        elif not reverse_ma_alignment:
            # 초기 매수 조건
            initial_buy_condition = ma60_cross_up_ma120
            
            # 재매수 조건
            rebuy_condition = (ma60_cross_up_ma120 and 
                              ma120_slope >= MA_BUY_SLOPE_THRESHOLD and 
                              ma240_slope >= MA_BUY_SLOPE_THRESHOLD and
                              ma240_360_deviation >= MA_DEVIATION_THRESHOLD)
            
            if initial_buy_condition or rebuy_condition:
                effective_capital = capital * (1 - fee_rate)
                position = effective_capital / current_price
                buy_price = current_price  # 매수 가격 저장
                buy_time = current_time  # 매수 시간 저장
                
                if rebuy_condition:
                    trade_log.append((current_time, 'Buy(Rebuy)', current_price, position))
                    print(f"{current_time} - BUY(재매수) at {current_price:.2f}, RSI: {current_rsi:.2f}, MA60/120 상방돌파, MA120/240 기울기: {ma120_slope:.2f}°/{ma240_slope:.2f}°, 이격도: {ma240_360_deviation:.4%}")
                else:
                    trade_log.append((current_time, 'Buy(Initial)', current_price, position))
                    print(f"{current_time} - BUY(초기매수) at {current_price:.2f}, RSI: {current_rsi:.2f}, MA60/120 상방돌파")
            elif (state[0] == 0 or 
                (state[1] == 1 and state[2] == 1 and current_rsi < 35) or 
                (current_price < current_lower_band and state[3] == 1) or
                state[4] == 1):  # 기존 급등 상태 매수 조건
                
                # 연속 손실이 너무 많으면 매수 제한
                if consecutive_losses < max_consecutive_losses:
                    # 이평선 급등 매수의 경우 추가 확인: RSI가 너무 높으면 매수하지 않음
                    if current_ma_surge and current_rsi > 70:  # RSI 임계값 상향 조정 (60 -> 70)
                        print(f"{current_time} - 이평선 급등 감지되었으나 RSI({current_rsi:.2f})가 너무 높아 매수 보류")
                    else:
                        effective_capital = capital * (1 - fee_rate)
                        position = effective_capital / current_price
                        buy_price = current_price  # 매수 가격 저장
                        buy_time = current_time  # 매수 시간 저장
                        
                        # 급등 상태인 경우 로그에 표시
                        if current_ma_surge:
                            trade_log.append((current_time, 'Buy(MA-Surge)', current_price, position))
                            print(f"{current_time} - BUY(이평선급등) at {current_price:.2f}, RSI: {current_rsi:.2f}, Position: {position:.6f}")
                        elif current_surge:  # current_surge_combined 대신 current_surge 사용
                            trade_log.append((current_time, 'Buy(Surge)', current_price, position))
                            print(f"{current_time} - BUY(급등) at {current_price:.2f}, RSI: {current_rsi:.2f}, Position: {position:.6f}")
                        else:
                            trade_log.append((current_time, 'Buy', current_price, position))
                            print(f"{current_time} - BUY at {current_price:.2f}, RSI: {current_rsi:.2f}, Position: {position:.6f}")
        else:
            print(f"{current_time} - 매수 신호 발생했으나 역배열 상태로 매수 보류")
    elif action == 2 and position > 0:
        # 최소/최대 보유 기간 확인
        hold_duration = (current_time - buy_time).total_seconds() / 60  # 분 단위로 변환
        
        # MA900과 MA360 하강 추세 확인 (추가)
        ma900_downtrend = is_ma900_downtrend(ma900.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
        ma360_slope = calculate_ma_slope(ma360.loc[:current_time])
        ma900_slope = calculate_ma_slope(ma900.loc[:current_time])
        ma300_slope = calculate_ma_slope(ma300.loc[:current_time])
        
        # 즉시 매도 조건: MA900이나 MA360의 기울기가 하락으로 전환
        if hold_duration >= min_hold_periods and (ma900_downtrend or ma360_slope < 0):
            effective_capital = position * current_price * (1 - fee_rate)
            capital = effective_capital
            
            # 매도 유형 결정
            sell_type = "Sell"
            if ma900_downtrend and ma360_slope < 0:
                sell_type = "Sell(MA900/MA360-Down)"
                print(f"{current_time} - MA900/MA360 하강 추세로 즉시 매도, MA900 기울기: {ma900_slope:.6f}, MA360 기울기: {ma360_slope:.6f}")
            elif ma900_downtrend:
                sell_type = "Sell(MA900-Down)"
                print(f"{current_time} - MA900 하강 추세로 즉시 매도, MA900 기울기: {ma900_slope:.6f}")
            elif ma360_slope < 0:
                sell_type = "Sell(MA360-Down)"
                print(f"{current_time} - MA360 하강 추세로 즉시 매도, MA360 기울기: {ma360_slope:.6f}")
            
            trade_log.append((current_time, sell_type, current_price, position))
            
            # 손익 계산
            profit_pct = (current_price / buy_price - 1) * 100
            
            # 손익 추적
            if profit_pct < 0:
                consecutive_losses += 1
                print(f"{current_time} - SELL({sell_type}) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 연속 손실: {consecutive_losses}, 보유기간: {hold_duration:.1f}분")
            else:
                consecutive_losses = 0  # 수익이 나면 연속 손실 카운트 리셋
                print(f"{current_time} - SELL({sell_type}) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 보유기간: {hold_duration:.1f}분")
            
            position = 0
            buy_time = None  # 매수 시간 초기화
        # 새로운 매도 조건:
        # 1. 120MA와 240MA의 이격도가 10초 전보다 근접하고,
        # 2. 60MA가 120MA를 하방 돌파하며,
        # 3. 120MA와 240MA의 기울기가 -2도 이상 하향
        
        # 매도 제한: 60MA가 360MA 위에 있거나 MA900이나 MA300이 상승 추세일 때
        if (hold_duration >= min_hold_periods and 
            abs(ma120_240_deviation) < abs(ma120_240_prev_deviation) and 
            ma60_cross_down_ma120 and 
            ma120_slope <= MA_SELL_SLOPE_THRESHOLD and ma240_slope <= MA_SELL_SLOPE_THRESHOLD):
            
            # 매도 제한 조건 확인
            ma60_above_ma360 = current_ma60 > current_ma360
            
            # MA300 상승 추세 확인
            ma300_uptrend = is_ma300_uptrend(ma300.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
            
            # MA900 상승 추세 확인
            ma900_uptrend = is_ma900_uptrend(ma900.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
            
            # MA300 하강 추세 확인 (추가)
            ma300_downtrend = is_ma300_downtrend(ma300.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
            
            # MA900 하강 추세 확인 (추가)
            ma900_downtrend = is_ma900_downtrend(ma900.loc[:current_time], window=MA900_UPTREND_WINDOW, min_slope=MA900_UPTREND_MIN_SLOPE)
            
            # MA360 기울기 확인 (추가)
            ma360_slope = calculate_ma_slope(ma360.loc[:current_time])
            
            # 매도 시 MA900 및 MA300 상태 로그 추가
            ma900_slope = calculate_ma_slope(ma900.loc[:current_time])
            ma300_slope = calculate_ma_slope(ma300.loc[:current_time])
            
            # 매도 신호 발생 여부 확인
            sell_signal = True
            
            # 추가 매도 조건: MA900이나 MA300이 하강 추세이거나 MA360 기울기가 음수일 때 매도
            force_sell_condition = ma900_downtrend or ma300_downtrend or ma360_slope < 0
            
            # 매도 제한: 60MA가 360MA 위에 있거나 MA900이나 MA300이 상승 추세일 때
            # 단, 하강 추세일 때는 매도 제한을 무시하고 매도
            if hold_duration >= max_hold_periods:
                # 최대 보유 기간 초과 시 무조건 매도
                effective_capital = position * current_price * (1 - fee_rate)
                capital = effective_capital
                trade_log.append((current_time, 'Sell(Max-Hold)', current_price, position))
                
                # 손익 계산
                profit_pct = (current_price / buy_price - 1) * 100
                
                # 손익 추적
                if profit_pct < 0:
                    consecutive_losses += 1
                    print(f"{current_time} - SELL(최대보유) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 연속 손실: {consecutive_losses}, 보유기간: {hold_duration:.1f}분")
                else:
                    consecutive_losses = 0  # 수익이 나면 연속 손실 카운트 리셋
                    print(f"{current_time} - SELL(최대보유) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 보유기간: {hold_duration:.1f}분")
                
                position = 0
                buy_time = None  # 매수 시간 초기화
            elif force_sell_condition:
                # 하강 추세일 때는 매도 실행
                effective_capital = position * current_price * (1 - fee_rate)
                capital = effective_capital
                
                # 매도 유형 결정
                sell_type = "Sell"
                if ma900_downtrend and ma300_downtrend:
                    sell_type = "Sell(MA900/MA300-Down)"
                    print(f"{current_time} - MA900/MA300 하강 추세로 매도 실행, MA900 기울기: {ma900_slope:.6f}, MA300 기울기: {ma300_slope:.6f}")
                elif ma900_downtrend:
                    sell_type = "Sell(MA900-Down)"
                    print(f"{current_time} - MA900 하강 추세로 매도 실행, MA900 기울기: {ma900_slope:.6f}")
                elif ma300_downtrend:
                    sell_type = "Sell(MA300-Down)"
                    print(f"{current_time} - MA300 하강 추세로 매도 실행, MA300 기울기: {ma300_slope:.6f}")
                elif ma360_slope < 0:
                    sell_type = "Sell(MA360-Down)"
                    print(f"{current_time} - MA360 하강 추세로 매도 실행, MA360 기울기: {ma360_slope:.6f}")
                
                trade_log.append((current_time, sell_type, current_price, position))
                
                # 손익 계산
                profit_pct = (current_price / buy_price - 1) * 100
                
                # 손익 추적
                if profit_pct < 0:
                    consecutive_losses += 1
                    print(f"{current_time} - SELL({sell_type}) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 연속 손실: {consecutive_losses}, 보유기간: {hold_duration:.1f}분")
                else:
                    consecutive_losses = 0  # 수익이 나면 연속 손실 카운트 리셋
                    print(f"{current_time} - SELL({sell_type}) at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 보유기간: {hold_duration:.1f}분")
                
                position = 0
                buy_time = None  # 매수 시간 초기화
            elif sell_signal and (ma60_above_ma360 or ma900_uptrend or ma300_uptrend):
                # 매도 제한 조건 로그 출력
                if ma60_above_ma360 and ma900_uptrend and ma300_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA60>MA360 및 MA900/MA300 상승 추세로 매도 보류, MA900 기울기: {ma900_slope:.6f}, MA300 기울기: {ma300_slope:.6f}")
                elif ma60_above_ma360 and ma900_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA60>MA360 및 MA900 상승 추세로 매도 보류, MA900 기울기: {ma900_slope:.6f}")
                elif ma60_above_ma360 and ma300_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA60>MA360 및 MA300 상승 추세로 매도 보류, MA300 기울기: {ma300_slope:.6f}")
                elif ma900_uptrend and ma300_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA900/MA300 상승 추세로 매도 보류, MA900 기울기: {ma900_slope:.6f}, MA300 기울기: {ma300_slope:.6f}")
                elif ma900_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA900 상승 추세로 매도 보류, MA900 기울기: {ma900_slope:.6f}")
                elif ma300_uptrend:
                    print(f"{current_time} - 매도 신호 발생했으나 MA300 상승 추세로 매도 보류, MA300 기울기: {ma300_slope:.6f}")
                else:
                    print(f"{current_time} - 매도 신호 발생했으나 MA60>MA360으로 매도 보류")
            else:
                effective_capital = position * current_price * (1 - fee_rate)
                capital = effective_capital
                trade_log.append((current_time, 'Sell', current_price, position))
                
                # 손익 계산
                profit_pct = (current_price / buy_price - 1) * 100
                
                # 손익 추적
                if profit_pct < 0:
                    consecutive_losses += 1
                    print(f"{current_time} - SELL at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 연속 손실: {consecutive_losses}, 보유기간: {hold_duration:.1f}분")
                else:
                    consecutive_losses = 0  # 수익이 나면 연속 손실 카운트 리셋
                    print(f"{current_time} - SELL at {current_price:.2f}, RSI: {current_rsi:.2f}, Profit: {profit_pct:.2f}%, 보유기간: {hold_duration:.1f}분")
                
                position = 0
                buy_time = None  # 매수 시간 초기화
    
    # 이전 상태 저장
    prev_state = state
    
    # 보상: 현재 net worth 변화량
    current_net = net_worth(capital, position, current_price)
    reward = current_net - prev_net_worth
    prev_net_worth = current_net
    
    # (간단화를 위해 next_state를 현재 state와 동일하게 사용)
    next_state = state
    
    # Q-learning 업데이트
    best_next = np.max(Q[next_state])
    Q[state][action] = Q[state][action] + alpha * (reward + gamma * best_next - Q[state][action])
    
    # 이전 MACD 값 업데이트
    prev_macd_line = current_macd_line
    prev_macd_signal = current_macd_signal

# 시뮬레이션 종료 후, 포지션 정리
if position > 0:
    final_time = df.index[-1]
    final_price = df.iloc[-1]['price']
    effective_capital = position * final_price * (1 - fee_rate)
    capital = effective_capital
    trade_log.append((final_time, 'Sell', final_price, position))
    print(f"{final_time} - FINAL SELL at {final_price:.2f}, Position: {position:.6f}")
    position = 0

profit = capital - initial_capital
return_pct = (capital / initial_capital - 1) * 100

print("\n=== FINAL RESULT ===")
print("Initial Capital:", initial_capital)
print("Final Capital:", capital)
print("Profit:", profit)
print("Return: {:.2f}%".format(return_pct))
print("Total Trades:", len(trade_log) // 2)  # 매수-매도 쌍의 수
print("\n=== TRADE LOG ===")
for log in trade_log:
    print(log)

# 거래 결과 시각화
if trade_log:
    plt.figure(figsize=(15, 15))  # 세로 크기 증가 (10 -> 15)
    
    # 가격 차트 (첫 번째 서브플롯)
    plt.subplot(3, 1, 1)  # 2행에서 3행으로 변경
    
    # 선택적으로 그래프 표시
    if SHOW_PRICE:
        plt.plot(df.index, df['price'], label='ETH 가격', alpha=0.7)
    
    # 이동평균선 추가 (선택적으로)
    if SHOW_MA60:
        plt.plot(ma60.index, ma60, label='MA60', alpha=0.7, linewidth=1, color='blue')
    if SHOW_MA120:
        plt.plot(ma120.index, ma120, label='MA120', alpha=0.7, linewidth=1, color='green')
    if SHOW_MA240:
        plt.plot(ma240.index, ma240, label='MA240', alpha=0.7, linewidth=1, color='purple')
    if SHOW_MA300:
        plt.plot(ma300.index, ma300, label='MA300', alpha=0.7, linewidth=1, color='brown')
    if SHOW_MA360:
        plt.plot(ma360.index, ma360, label='MA360', alpha=0.7, linewidth=1, color='orange')
    if SHOW_MA900:
        plt.plot(ma900.index, ma900, label='MA900', alpha=0.7, linewidth=1.5, color='red')
    
    # 매수/매도 포인트 표시 (모든 유형 포함)
    buy_times = []
    buy_prices = []
    sell_times = []
    sell_prices = []
    
    for log in trade_log:
        if 'Buy' in log[1]:  # 'Buy'나 'Buy(Surge)' 등 모든 매수 유형 포함
            buy_times.append(log[0])
            buy_prices.append(log[2])
        elif 'Sell' in log[1]:  # 'Sell'이나 'Sell(Drop)' 등 모든 매도 유형 포함
            sell_times.append(log[0])
            sell_prices.append(log[2])
    
    plt.scatter(buy_times, buy_prices, color='green', marker='^', s=100, label='매수')
    plt.scatter(sell_times, sell_prices, color='red', marker='v', s=100, label='매도')
    
    # 급등 매수 포인트 특별 표시
    surge_buy_times = [log[0] for log in trade_log if log[1] == 'Buy(Surge)']
    surge_buy_prices = [log[2] for log in trade_log if log[1] == 'Buy(Surge)']
    if surge_buy_times:
        plt.scatter(surge_buy_times, surge_buy_prices, color='blue', marker='*', s=150, label='급등 매수')
    
    # 이평선 급등 매수 포인트 특별 표시
    ma_surge_buy_times = [log[0] for log in trade_log if log[1] == 'Buy(MA-Surge)']
    ma_surge_buy_prices = [log[2] for log in trade_log if log[1] == 'Buy(MA-Surge)']
    if ma_surge_buy_times:
        plt.scatter(ma_surge_buy_times, ma_surge_buy_prices, color='cyan', marker='*', s=200, label='이평선 급등 매수')
    
    # 급락 매도 포인트 특별 표시
    drop_sell_times = [log[0] for log in trade_log if log[1] == 'Sell(Drop)']
    drop_sell_prices = [log[2] for log in trade_log if log[1] == 'Sell(Drop)']
    if drop_sell_times:
        plt.scatter(drop_sell_times, drop_sell_prices, color='purple', marker='x', s=150, label='급락 매도')
    
    # 손절매 매도 포인트 특별 표시
    stop_loss_sell_times = [log[0] for log in trade_log if log[1] == 'Sell(Stop-Loss)']
    stop_loss_sell_prices = [log[2] for log in trade_log if log[1] == 'Sell(Stop-Loss)']
    if stop_loss_sell_times:
        plt.scatter(stop_loss_sell_times, stop_loss_sell_prices, color='black', marker='x', s=200, label='손절매 매도')
    
    plt.title('ETH 가격, 이동평균선 및 거래 내역')
    plt.ylabel('가격 (KRW)')
    plt.legend(loc='upper left')
    plt.grid(True)
    
    # 자본금 변화 차트 (두 번째 서브플롯)
    plt.subplot(3, 1, 2)  # 2행에서 3행으로 변경
    
    # 자본금 변화 계산
    capital_history = [initial_capital]
    times = [df.index[0]]
    
    current_capital = initial_capital
    for i, log in enumerate(trade_log):
        if 'Buy' in log[1]:
            # 매수 시 자본금 감소 (포지션으로 전환)
            current_capital = 0  # 모든 자본금을 포지션으로 전환
        elif 'Sell' in log[1]:
            # 매도 시 자본금 증가
            current_capital = log[2] * log[3] * (1 - fee_rate)
            capital_history.append(current_capital)
            times.append(log[0])
    
    plt.plot(times, capital_history, 'b-', label='자본금')
    plt.title('자본금 변화')
    plt.ylabel('자본금 (KRW)')
    plt.legend()
    plt.grid(True)
    
    # 이동평균선 값 표시 (세 번째 서브플롯)
    plt.subplot(3, 1, 3)  # 새로운 서브플롯 추가
    
    # 이동평균선 값 계산
    last_time = df.index[-1]
    last_ma60 = ma60.asof(last_time) if not pd.isna(ma60.asof(last_time)) else None
    last_ma120 = ma120.asof(last_time) if not pd.isna(ma120.asof(last_time)) else None
    last_ma240 = ma240.asof(last_time) if not pd.isna(ma240.asof(last_time)) else None
    last_ma300 = ma300.asof(last_time) if not pd.isna(ma300.asof(last_time)) else None
    last_ma360 = ma360.asof(last_time) if not pd.isna(ma360.asof(last_time)) else None
    last_ma900 = ma900.asof(last_time) if not pd.isna(ma900.asof(last_time)) else None
    
    # 이동평균선 값을 막대 그래프로 표시
    ma_periods = ['MA60', 'MA120', 'MA240', 'MA300', 'MA360', 'MA900']
    ma_values = [last_ma60, last_ma120, last_ma240, last_ma300, last_ma360, last_ma900]
    
    plt.bar(ma_periods, ma_values, color='skyblue')
    plt.title('이동평균선 값 비교')
    plt.ylabel('가격 (KRW)')
    plt.grid(True, axis='y')
    
    # 막대 위에 값 표시
    for i, v in enumerate(ma_values):
        plt.text(i, v + 5000, f'{v:,.0f}', ha='center', fontsize=9)
    
    # 이동평균선 값 텍스트 정보
    ma_text = f"""
    최종 이동평균선 값 (마지막 시점: {last_time}):
    MA60: {last_ma60:,.0f} KRW
    MA120: {last_ma120:,.0f} KRW
    MA240: {last_ma240:,.0f} KRW
    MA300: {last_ma300:,.0f} KRW
    MA360: {last_ma360:,.0f} KRW
    MA900: {last_ma900:,.0f} KRW
    """
    
    plt.tight_layout()
    
    # 그래프를 파일로 저장
    plt.savefig('trading_result.png', dpi=300, bbox_inches='tight')
    print(f"그래프가 'trading_result.png' 파일로 저장되었습니다.")
    print(ma_text)
    
    # 그래프를 화면에 표시 (새 창에서 열림)
    plt.show(block=True)  # block=True로 설정하여 그래프 창이 닫힐 때까지 코드 실행을 중단
    
    # 저장된 그래프 파일을 운영 체제의 기본 이미지 뷰어로 열기
    try:
        # Windows 환경에서 파일 열기
        os.startfile('trading_result.png')
    except AttributeError:
        # Linux나 Mac 환경에서 파일 열기
        subprocess.call(['xdg-open', 'trading_result.png'])
