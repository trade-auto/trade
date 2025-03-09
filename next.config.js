/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev, isServer }) => {
    // 개발 모드에서만 적용
    if (dev && !isServer) {
      // 웹팩 개발 서버 구성 조정
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000, // 폴링 간격 조정
        aggregateTimeout: 300, // 변경 감지 후 재빌드 전 지연 시간
      };
    }
    return config;
  },
}

module.exports = nextConfig 