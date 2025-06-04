/**
 * 고급 유틸리티 함수 모듈
 * 날짜, 가격 포맷팅 및 성능 최적화 함수들을 제공합니다.
 * @module AdvancedUtils
 * @version 1.0.0
 */

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷팅합니다.
 * @param {Date|string|number} date - 포맷팅할 날짜
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열
 * @throws {TypeError} 유효하지 않은 날짜 입력시
 * @example
 * formatDate(new Date()) // "2024-03-15"
 * formatDate("2024-03-15") // "2024-03-15"
 */
const formatDate = (date) => {
    try {
        // 입력값 검증
        if (date === null || date === undefined) {
            throw new TypeError('날짜 값이 null 또는 undefined입니다.');
        }

        const dateObj = new Date(date);
        
        // 유효한 날짜인지 확인
        if (isNaN(dateObj.getTime())) {
            throw new TypeError(`유효하지 않은 날짜입니다: ${date}`);
        }

        return dateObj.toISOString().split('T')[0];
    } catch (error) {
        console.error('formatDate 오류:', error.message);
        throw error;
    }
};

/**
 * 가격을 지정된 통화 형식으로 포맷팅합니다.
 * @param {number} price - 포맷팅할 가격
 * @param {string} [currency='KRW'] - 통화 코드 (기본값: KRW)
 * @param {string} [locale='ko-KR'] - 로케일 (기본값: ko-KR)
 * @returns {string} 포맷팅된 가격 문자열
 * @throws {TypeError} 유효하지 않은 가격 입력시
 * @example
 * formatPrice(1000000) // "₩1,000,000"
 * formatPrice(1234.56, 'USD', 'en-US') // "$1,234.56"
 */
const formatPrice = (price, currency = 'KRW', locale = 'ko-KR') => {
    try {
        // 입력값 검증
        if (typeof price !== 'number' || isNaN(price)) {
            throw new TypeError(`가격은 유효한 숫자여야 합니다: ${price}`);
        }

        if (price < 0) {
            console.warn('음수 가격이 입력되었습니다:', price);
        }

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'KRW' ? 0 : 2
        }).format(price);
    } catch (error) {
        console.error('formatPrice 오류:', error.message);
        // 기본 포맷팅으로 폴백
        return `${price.toLocaleString()} ${currency}`;
    }
};

/**
 * 두 값 사이의 백분율 변화를 계산합니다.
 * @param {number} current - 현재 값
 * @param {number} previous - 이전 값
 * @param {number} [precision=2] - 소수점 자릿수 (기본값: 2)
 * @returns {number} 백분율 변화 (-100 ~ Infinity)
 * @throws {TypeError} 유효하지 않은 숫자 입력시
 * @throws {Error} 이전 값이 0일 때
 * @example
 * calculatePercentage(110, 100) // 10.00
 * calculatePercentage(90, 100, 1) // -10.0
 */
const calculatePercentage = (current, previous, precision = 2) => {
    try {
        // 입력값 검증
        if (typeof current !== 'number' || typeof previous !== 'number') {
            throw new TypeError('현재값과 이전값은 모두 숫자여야 합니다.');
        }

        if (isNaN(current) || isNaN(previous)) {
            throw new TypeError('NaN 값은 허용되지 않습니다.');
        }

        if (previous === 0) {
            throw new Error('이전 값이 0이면 백분율을 계산할 수 없습니다.');
        }

        const percentage = ((current - previous) / previous) * 100;
        return Number(percentage.toFixed(precision));
    } catch (error) {
        console.error('calculatePercentage 오류:', error.message);
        throw error;
    }
};

/**
 * 함수 호출을 지연시키는 디바운스 함수를 생성합니다.
 * @param {Function} func - 디바운스할 함수
 * @param {number} wait - 지연 시간 (밀리초)
 * @param {boolean} [immediate=false] - 즉시 실행 여부
 * @returns {Function} 디바운스된 함수
 * @throws {TypeError} 유효하지 않은 함수 또는 시간 입력시
 * @example
 * const debouncedSearch = debounce(searchFunction, 300);
 */
const debounce = (func, wait, immediate = false) => {
    try {
        // 입력값 검증
        if (typeof func !== 'function') {
            throw new TypeError('첫 번째 인자는 함수여야 합니다.');
        }

        if (typeof wait !== 'number' || wait < 0) {
            throw new TypeError('대기 시간은 음이 아닌 숫자여야 합니다.');
        }

        let timeout;
        let lastArgs;
        let lastThis;

        return function executedFunction(...args) {
            lastArgs = args;
            lastThis = this;

            const later = () => {
                timeout = null;
                if (!immediate) {
                    try {
                        func.apply(lastThis, lastArgs);
                    } catch (error) {
                        console.error('디바운스된 함수 실행 오류:', error);
                    }
                }
            };

            const callNow = immediate && !timeout;
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) {
                try {
                    return func.apply(this, args);
                } catch (error) {
                    console.error('즉시 실행 함수 오류:', error);
                    throw error;
                }
            }
        };
    } catch (error) {
        console.error('debounce 생성 오류:', error.message);
        throw error;
    }
};

/**
 * 함수 호출 빈도를 제한하는 스로틀 함수를 생성합니다.
 * @param {Function} func - 스로틀할 함수
 * @param {number} limit - 제한 시간 (밀리초)
 * @param {Object} [options={}] - 옵션 객체
 * @param {boolean} [options.leading=true] - 첫 번째 호출 즉시 실행 여부
 * @param {boolean} [options.trailing=true] - 마지막 호출 실행 여부
 * @returns {Function} 스로틀된 함수
 * @throws {TypeError} 유효하지 않은 함수 또는 시간 입력시
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 */
const throttle = (func, limit, options = {}) => {
    try {
        // 입력값 검증
        if (typeof func !== 'function') {
            throw new TypeError('첫 번째 인자는 함수여야 합니다.');
        }

        if (typeof limit !== 'number' || limit < 0) {
            throw new TypeError('제한 시간은 음이 아닌 숫자여야 합니다.');
        }

        const { leading = true, trailing = true } = options;
        let inThrottle = false;
        let lastFunc;
        let lastRan;

        return function throttledFunction(...args) {
            const context = this;

            if (!inThrottle) {
                if (leading) {
                    try {
                        func.apply(context, args);
                    } catch (error) {
                        console.error('스로틀된 함수 실행 오류:', error);
                    }
                }
                lastRan = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                if (trailing) {
                    lastFunc = setTimeout(() => {
                        if (Date.now() - lastRan >= limit) {
                            try {
                                func.apply(context, args);
                            } catch (error) {
                                console.error('스로틀 지연 함수 실행 오류:', error);
                            }
                            lastRan = Date.now();
                        }
                    }, limit - (Date.now() - lastRan));
                }
            }

            setTimeout(() => {
                inThrottle = false;
            }, limit);
        };
    } catch (error) {
        console.error('throttle 생성 오류:', error.message);
        throw error;
    }
};

/**
 * 비동기 함수의 재시도 로직을 제공합니다.
 * @param {Function} asyncFunc - 재시도할 비동기 함수
 * @param {number} [maxRetries=3] - 최대 재시도 횟수
 * @param {number} [delay=1000] - 재시도 간격 (밀리초)
 * @returns {Promise} 결과 또는 최종 오류
 * @example
 * const result = await retryAsync(() => fetchData(), 3, 2000);
 */
const retryAsync = async (asyncFunc, maxRetries = 3, delay = 1000) => {
    try {
        if (typeof asyncFunc !== 'function') {
            throw new TypeError('첫 번째 인자는 함수여야 합니다.');
        }

        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                return await asyncFunc();
            } catch (error) {
                lastError = error;
                console.warn(`시도 ${attempt}/${maxRetries + 1} 실패:`, error.message);
                
                if (attempt <= maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    } catch (error) {
        console.error('retryAsync 오류:', error.message);
        throw error;
    }
};

// ES6 모듈 문법 사용
module.exports = {
    formatDate,
    formatPrice,
    calculatePercentage,
    debounce,
    throttle,
    retryAsync
};

// CommonJS와 ES6 모듈 호환성
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        formatPrice,
        calculatePercentage,
        debounce,
        throttle,
        retryAsync
    };
}