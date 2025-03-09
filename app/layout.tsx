import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: '트레이딩 계정 관리',
  description: '트레이딩 계정 정보 및 주문 관리',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head />
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
