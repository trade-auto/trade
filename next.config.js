/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WSL에서 Windows 브라우저로 접근 가능하도록 설정
  serverExternalPackages: ['ws'],
}

module.exports = nextConfig 