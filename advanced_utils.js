// 고급 유틸리티 함수들 (개선 전)
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatPrice(price, currency = 'KRW') {
    return price.toLocaleString('ko-KR', {
        style: 'currency',
        currency: currency
    });
}

function calculatePercentage(current, previous) {
    return ((current - previous) / previous) * 100;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

module.exports = {
    formatDate,
    formatPrice, 
    calculatePercentage,
    debounce,
    throttle
};