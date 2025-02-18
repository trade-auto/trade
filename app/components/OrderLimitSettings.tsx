'use client';

import { useState, useEffect } from 'react';

export function OrderLimitSettings() {
  const [settings, setSettings] = useState({
    minOrderPrice: 5000,
    maxOrderPrice: 1000000000
  });
  const [isEditing, setIsEditing] = useState(false);

  // 컴포넌트 마운트 시 localStorage에서 설정 불러오기
  useEffect(() => {
    const savedSettings = localStorage.getItem('orderLimitSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // 설정 저장
  const handleSave = () => {
    localStorage.setItem('orderLimitSettings', JSON.stringify(settings));
    setIsEditing(false);
  };

  return (
    <div className="mb-8 bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">주문 제한 설정</h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            설정 변경
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              저장
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              취소
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-400 mb-2">최소 주문 금액 (KRW)</label>
          {isEditing ? (
            <input
              type="number"
              value={settings.minOrderPrice}
              onChange={(e) => setSettings({
                ...settings,
                minOrderPrice: Number(e.target.value)
              })}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded"
              min="0"
              step="1000"
            />
          ) : (
            <div className="px-4 py-2 bg-gray-700 text-white rounded">
              {settings.minOrderPrice.toLocaleString()} KRW
            </div>
          )}
        </div>

        <div>
          <label className="block text-gray-400 mb-2">최대 주문 금액 (KRW)</label>
          {isEditing ? (
            <input
              type="number"
              value={settings.maxOrderPrice}
              onChange={(e) => setSettings({
                ...settings,
                maxOrderPrice: Number(e.target.value)
              })}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded"
              min="0"
              step="1000000"
            />
          ) : (
            <div className="px-4 py-2 bg-gray-700 text-white rounded">
              {settings.maxOrderPrice.toLocaleString()} KRW
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 