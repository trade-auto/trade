import Link from 'next/link';

interface NavigationHeaderProps {
  currentPage: 'monitor' | 'account' | 'orders' | 'order';
}

export function NavigationHeader({ currentPage }: NavigationHeaderProps) {
  return (
    <div className="flex flex-col space-y-4 mb-8">
      <h1 className="text-3xl font-bold text-white text-center">
        {currentPage === 'monitor' ? 'Upbit 실시간 모니터링' : 
         currentPage === 'account' ? '계좌 및 주문 정보' : 
         currentPage === 'orders' ? '주문 조회' : '주문 조회'}
      </h1>
      <div className="flex justify-center items-center w-full">
        <Link
          href="/"
          className={`px-6 py-2 ${
            currentPage === 'monitor' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white rounded-lg flex-1 text-center max-w-[200px]`}
        >
          실시간 모니터링
        </Link>
        <div className="mx-4 h-6 w-px bg-gray-500" />
        <Link
          href="/account"
          className={`px-6 py-2 ${
            currentPage === 'account' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white rounded-lg flex-1 text-center max-w-[200px]`}
        >
          계좌 및 주문 정보
        </Link>
        <div className="mx-4 h-6 w-px bg-gray-500" />
        <Link
          href="/orders"
          className={`px-6 py-2 ${
            currentPage === 'orders' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white rounded-lg flex-1 text-center max-w-[200px]`}
        >
          주문 조회
        </Link>
      </div>
    </div>
  );
} 