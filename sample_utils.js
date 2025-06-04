/**
 * 에러 핸들링을 추가하고, JSDoc 주석을 작성하고, 입력값 검증을 강화해주세요. ES6+...
 */
try {
// 간단한 유틸리티 함수들 (수정 전)
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatPrice(price) {
    return price.toLocaleString();
}

function calculatePercentage(current, previous) {
    return ((current - previous) / previous) * 100;
}

module.exports = { formatDate, formatPrice, calculatePercentage };
} catch (error) {
    console.error('Error:', error);
    throw error;
}