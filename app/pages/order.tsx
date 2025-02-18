import { CreateOrder } from '../components/CreateOrder';
import { OrderLimitSettings } from '../components/OrderLimitSettings';
import { NavigationHeader } from '../components/NavigationHeader';
import { OrderList } from '../components/OrderList';

export default function OrderPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <NavigationHeader currentPage="order" />
        
        {/* 주문하기 */}
        <CreateOrder market="KRW-BTC" />
        
        {/* 주문 제한 설정 */}
        <OrderLimitSettings />
        
        {/* 주문 목록 */}
        <OrderList />
      </div>
    </main>
  );
} 