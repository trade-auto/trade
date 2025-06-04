#!/usr/bin/env node

/**
 * JavaScript AutoClaude MCP 사용 예시 데모
 * 실제 코드 개선 과정을 시연합니다.
 */

const { formatDate, formatPrice, calculatePercentage, debounce, throttle, retryAsync } = require('./improved_utils.js');

console.log('🚀 JavaScript AutoClaude MCP 개선 결과 데모\n');

// ================================
// 1. 날짜 포맷팅 테스트
// ================================
console.log('📅 날짜 포맷팅 테스트:');
console.log('-'.repeat(30));

try {
    console.log('✅ 정상:', formatDate(new Date()));
    console.log('✅ 문자열:', formatDate('2024-03-15'));
    console.log('✅ 타임스탬프:', formatDate(1710460800000));
} catch (error) {
    console.error('❌ 오류:', error.message);
}

try {
    console.log('❌ 잘못된 입력:', formatDate('invalid-date'));
} catch (error) {
    console.error('✅ 예상된 오류 처리:', error.message);
}

// ================================
// 2. 가격 포맷팅 테스트
// ================================
console.log('\n💰 가격 포맷팅 테스트:');
console.log('-'.repeat(30));

try {
    console.log('✅ 원화:', formatPrice(1234567));
    console.log('✅ 달러:', formatPrice(1234.56, 'USD', 'en-US'));
    console.log('✅ 유로:', formatPrice(999.99, 'EUR', 'de-DE'));
    console.log('✅ 음수 (경고):', formatPrice(-100));
} catch (error) {
    console.error('❌ 오류:', error.message);
}

try {
    console.log('❌ 잘못된 입력:', formatPrice('not-a-number'));
} catch (error) {
    console.error('✅ 예상된 오류 처리:', error.message);
}

// ================================
// 3. 백분율 계산 테스트
// ================================
console.log('\n📈 백분율 계산 테스트:');
console.log('-'.repeat(30));

try {
    console.log('✅ 상승:', calculatePercentage(110, 100) + '%');
    console.log('✅ 하락:', calculatePercentage(90, 100) + '%');
    console.log('✅ 정밀도:', calculatePercentage(133.333, 100, 4) + '%');
} catch (error) {
    console.error('❌ 오류:', error.message);
}

try {
    console.log('❌ 0으로 나누기:', calculatePercentage(100, 0));
} catch (error) {
    console.error('✅ 예상된 오류 처리:', error.message);
}

// ================================
// 4. 디바운스 테스트
// ================================
console.log('\n⏱️ 디바운스 테스트:');
console.log('-'.repeat(30));

let searchCount = 0;
const mockSearch = (query) => {
    searchCount++;
    console.log(`🔍 검색 실행 #${searchCount}: "${query}"`);
};

const debouncedSearch = debounce(mockSearch, 300);

console.log('빠른 연속 호출 (300ms 디바운스):');
debouncedSearch('a');
debouncedSearch('ab');
debouncedSearch('abc');
debouncedSearch('abcd');

setTimeout(() => {
    console.log('→ 결과: 마지막 호출만 실행됨\n');
}, 500);

// ================================
// 5. 스로틀 테스트
// ================================
setTimeout(() => {
    console.log('🚦 스로틀 테스트:');
    console.log('-'.repeat(30));

    let scrollCount = 0;
    const mockScroll = () => {
        scrollCount++;
        console.log(`📜 스크롤 이벤트 #${scrollCount}`);
    };

    const throttledScroll = throttle(mockScroll, 200);

    console.log('빠른 연속 호출 (200ms 스로틀):');
    
    // 빠른 연속 호출 시뮬레이션
    const interval = setInterval(() => {
        throttledScroll();
    }, 50);

    setTimeout(() => {
        clearInterval(interval);
        console.log('→ 결과: 제한된 빈도로만 실행됨\n');
    }, 450);
}, 600);

// ================================
// 6. 비동기 재시도 테스트
// ================================
setTimeout(async () => {
    console.log('🔄 비동기 재시도 테스트:');
    console.log('-'.repeat(30));

    let attemptCount = 0;
    const unstableAPI = async () => {
        attemptCount++;
        console.log(`📡 API 호출 시도 #${attemptCount}`);
        
        if (attemptCount < 3) {
            throw new Error('네트워크 오류');
        }
        
        return { data: '성공적인 응답' };
    };

    try {
        console.log('불안정한 API 호출 (2회 실패 후 성공):');
        const result = await retryAsync(unstableAPI, 3, 500);
        console.log('✅ 최종 성공:', result);
    } catch (error) {
        console.error('❌ 최종 실패:', error.message);
    }
}, 1200);

// ================================
// 7. 실제 트레이딩 데이터 예시
// ================================
setTimeout(() => {
    console.log('\n💹 실제 트레이딩 데이터 예시:');
    console.log('-'.repeat(40));

    const tradingData = [
        { date: '2024-03-15', price: 85000000, symbol: 'BTC' },
        { date: '2024-03-16', price: 87500000, symbol: 'BTC' },
        { date: '2024-03-17', price: 83200000, symbol: 'BTC' }
    ];

    tradingData.forEach((data, index) => {
        const formattedDate = formatDate(data.date);
        const formattedPrice = formatPrice(data.price);
        
        if (index > 0) {
            const prevPrice = tradingData[index - 1].price;
            const change = calculatePercentage(data.price, prevPrice);
            const changeSymbol = change > 0 ? '📈' : '📉';
            
            console.log(`${formattedDate}: ${formattedPrice} ${changeSymbol} ${change}%`);
        } else {
            console.log(`${formattedDate}: ${formattedPrice}`);
        }
    });

    console.log('\n🎉 모든 테스트 완료!');
    console.log('📝 개선사항:');
    console.log('  • ✅ 강화된 에러 핸들링');
    console.log('  • ✅ 상세한 JSDoc 주석');
    console.log('  • ✅ 입력값 검증');
    console.log('  • ✅ ES6+ 문법 적용');
    console.log('  • ✅ 타입 안전성 향상');
    console.log('  • ✅ 성능 최적화 함수 추가');
    console.log('  • ✅ 실용적인 유틸리티 함수');
}, 2000);