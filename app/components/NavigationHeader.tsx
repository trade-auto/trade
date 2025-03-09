import Link from 'next/link';

interface NavigationHeaderProps {
  currentPage: 'account' | 'orders' | 'order';
}

export function NavigationHeader({ currentPage }: NavigationHeaderProps) {
  const navigation = [
    { name: '주문', href: '/order', current: currentPage === 'order' },
    { name: '주문 조회', href: '/orders', current: currentPage === 'orders' },
    { name: '계정', href: '/account', current: currentPage === 'account' },
  ];

  return (
    <div className="flex flex-col space-y-4 mb-8">
      <h1 className="text-3xl font-bold text-white text-center">
        {currentPage === 'account' ? '계좌 및 주문 정보' : 
         currentPage === 'orders' ? '주문 조회' : '주문 등록'}
      </h1>
      <div className="flex justify-center items-center w-full">
        <Link
          href="/order"
          className={`px-6 py-2 ${
            currentPage === 'order' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white rounded-lg flex-1 text-center max-w-[200px]`}
        >
          주문 등록
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