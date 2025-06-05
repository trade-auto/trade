'use client';

import React, { useState } from 'react';
import ClaudeMessageWindow from './ClaudeMessageWindow';

interface WindowConfig {
  id: number;
  websocketUrl: string;
  isActive: boolean;
}

export const MultiClaudeMessageWindows: React.FC = () => {
  const [windows, setWindows] = useState<WindowConfig[]>([
    { id: 1, websocketUrl: 'ws://localhost:8082', isActive: true }
  ]);

  const addWindow = () => {
    const newId = Math.max(...windows.map(w => w.id)) + 1;
    const newPort = 8082 + newId - 1;
    setWindows([...windows, {
      id: newId,
      websocketUrl: `ws://localhost:${newPort}`,
      isActive: true
    }]);
  };

  const removeWindow = (id: number) => {
    if (windows.length > 1) {
      setWindows(windows.filter(w => w.id !== id));
    }
  };

  const toggleWindow = (id: number) => {
    setWindows(windows.map(w => 
      w.id === id ? { ...w, isActive: !w.isActive } : w
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={addWindow}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + 새 대화창 추가
        </button>
        <span className="text-gray-400">
          활성 대화창: {windows.filter(w => w.isActive).length} / {windows.length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {windows.map((window) => (
          <div key={window.id} className="relative">
            {window.isActive && (
              <ClaudeMessageWindow
                windowId={window.id}
                websocketUrl={window.websocketUrl}
                className="w-full"
              />
            )}
            <div className="absolute top-2 right-2 flex space-x-2">
              <button
                onClick={() => toggleWindow(window.id)}
                className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                {window.isActive ? '숨기기' : '보이기'}
              </button>
              {windows.length > 1 && (
                <button
                  onClick={() => removeWindow(window.id)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiClaudeMessageWindows;