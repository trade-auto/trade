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

  // 초기 설정값 상수 추가
  const DEFAULT_SETTINGS = {
    minOrderPrice: 5000,
    maxOrderPrice: 1000000000
  };

  // 초기화 함수 수정
  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    // 초기화된 설정을 localStorage에 저장
    localStorage.setItem('orderLimitSettings', JSON.stringify(DEFAULT_SETTINGS));
    // 이벤트 발생
    const event = new CustomEvent('orderLimitSettingsChanged', {
      detail: DEFAULT_SETTINGS
    });
    window.dispatchEvent(event);
  };

  // 설정 저장
  const handleSave = () => {
    localStorage.setItem('orderLimitSettings', JSON.stringify(settings));
    
    // CustomEvent를 발생시켜 설정 변경을 알림
    const event = new CustomEvent('orderLimitSettingsChanged', {
      detail: settings
    });
    window.dispatchEvent(event);
    
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
              onClick={handleReset}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
            >
              초기화
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
              {settings.minOrderPrice.toLocaleString()},원
            </div>
          )}
        </div>

        <div>
          <label className="block text-gray-400 mb-2">최대 주문 금액 (KRW)</label>
          <div className="space-y-2">
            {isEditing ? (
              <>
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
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: 0
                    }))}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    0원
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: prev.maxOrderPrice + 100000
                    }))}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    +10만원
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: prev.maxOrderPrice + 500000
                    }))}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    +50만원
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: prev.maxOrderPrice + 1000000
                    }))}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    +100만원
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: prev.maxOrderPrice + 10000000
                    }))}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    +1000만원
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      maxOrderPrice: DEFAULT_SETTINGS.maxOrderPrice
                    }))}
                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                  >
                    금액초기화
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 py-2 bg-gray-700 text-white rounded">
                {settings.maxOrderPrice.toLocaleString()},원
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 