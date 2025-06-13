/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WSL에서 Windows 브라우저로 접근 가능하도록 설정
  serverExternalPackages: ['ws'],
  // HMR 설정
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // 1초마다 파일 변경 확인
        aggregateTimeout: 300, // 변경 후 300ms 대기
        ignored: /node_modules/,
      };
    }
    return config;
  },
  // 개발 서버 설정
  devIndicators: {
    position: 'bottom-right',
  },
  // ESLint 임시 비활성화
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig