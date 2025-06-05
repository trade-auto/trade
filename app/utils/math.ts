// 기본 수학 연산 유틸리티 함수

// 두 수의 덧셈 함수
export const add = (a: number, b: number): number => a + b;

// 1+1 계산 상수
export const SIMPLE_CALCULATION = 1 + 1;

// 결과 상수
export const RESULT = 2;

// 1+1=2 검증 함수
export const verifySimpleCalculation = (): boolean => {
  return add(1, 1) === RESULT && SIMPLE_CALCULATION === RESULT;
};