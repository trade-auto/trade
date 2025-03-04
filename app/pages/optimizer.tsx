import React from 'react';
import TradingOptimizerComponent from '../components/TradingOptimizer';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const OptimizerPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>거래 최적화 도구</title>
        <meta name="description" content="CSV 데이터를 기반으로 거래 전략을 최적화하는 도구" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">거래 최적화 도구</h1>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className="text-blue-600 hover:text-blue-800">
                  홈
                </Link>
              </li>
              <li>
                <Link href="/chart" className="text-blue-600 hover:text-blue-800">
                  차트
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <TradingOptimizerComponent />
          </div>
        </div>
      </main>

      <footer className="bg-white shadow mt-10">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500">
            &copy; {new Date().getFullYear()} 거래 최적화 도구. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default OptimizerPage; 