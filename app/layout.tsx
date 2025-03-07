import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Upbit 실시간 모니터링',
  description: '업비트 실시간 차트 모니터링',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="__className_d65c78" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
