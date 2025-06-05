'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
}

interface LogEntry {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

interface ClaudeStep {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'error';
  timestamp: Date;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export default function MCPDashboard() {
  // 상태 관리
  const [isLoopRunning, setIsLoopRunning] = useState(false);
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  
  // 프로젝트 설정
  const [projectName, setProjectName] = useState('trade');
  const [projectPath, setProjectPath] = useState('/mnt/f/200.workspace/trade');
  const [command, setCommand] = useState('npm run dev');
  const [customCommand, setCustomCommand] = useState('');
  
  // 작업 관련
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    type: 'bug'
  });
  
  // 로그
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState('all');
  
  // Claude 진행 상황
  const [claudeSteps, setClaudeSteps] = useState<ClaudeStep[]>([]);
  const [claudeStatus, setClaudeStatus] = useState<'waiting' | 'active' | 'completed' | 'error'>('waiting');
  const [claudeTaskTitle, setClaudeTaskTitle] = useState('작업 준비 중...');
  
  // 채팅
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  
  // 통계
  const [stats, setStats] = useState({
    totalTasks: 0,
    successTasks: 0,
    failedTasks: 0
  });

  // 로그 추가
  const addLog = (level: LogEntry['level'], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      level,
      message,
      timestamp: new Date()
    };
    setLogs(prev => [...prev, newLog].slice(-100)); // 최근 100개만 유지
  };

  // Claude 단계 추가
  const addClaudeStep = (title: string, description: string, status: ClaudeStep['status'] = 'completed') => {
    const newStep: ClaudeStep = {
      id: Date.now().toString(),
      title,
      description,
      status,
      timestamp: new Date()
    };
    setClaudeSteps(prev => [...prev, newStep]);
  };

  // 채팅 메시지 추가
  const addChatMessage = (type: ChatMessage['type'], content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, newMessage]);
  };

  // 작업 생성
  const createTask = () => {
    if (!newTask.title || !newTask.description) {
      addLog('error', '작업 제목과 설명을 입력해주세요.');
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      status: 'pending',
      createdAt: new Date()
    };

    setTasks(prev => [...prev, task]);
    addLog('info', `새 작업 생성: ${task.title}`);
    
    // 폼 초기화
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      type: 'bug'
    });

    // 루프가 실행 중이면 즉시 처리
    if (isLoopRunning && !currentTask) {
      setTimeout(() => processNextTask(), 500);
    }
  };

  // 다음 작업 처리
  const processNextTask = () => {
    const pendingTask = tasks.find(t => t.status === 'pending');
    if (!pendingTask) {
      addLog('info', '처리할 작업이 없습니다.');
      return;
    }

    setCurrentTask(pendingTask);
    setTasks(prev => prev.map(t => 
      t.id === pendingTask.id ? { ...t, status: 'running' } : t
    ));

    // Claude 진행 상황 시작
    startClaudeTask(pendingTask);
  };

  // Claude 작업 시작
  const startClaudeTask = (task: Task) => {
    setClaudeTaskTitle(task.title);
    setClaudeStatus('active');
    setClaudeSteps([]);
    
    addClaudeStep('작업 분석 시작', '작업 내용을 분석하고 있습니다...', 'active');
    
    // 시뮬레이션
    simulateClaudeProcessing(task);
  };

  // Claude 처리 시뮬레이션
  const simulateClaudeProcessing = (task: Task) => {
    const steps = [
      { title: '파일 분석', description: '관련 파일을 검색하고 있습니다...', delay: 2000 },
      { title: '코드 검토', description: '코드를 분석 중...', delay: 3000 },
      { title: '문제 진단', description: '문제를 확인하고 있습니다...', delay: 2500 },
      { title: '해결책 탐색', description: '최적의 해결 방법을 찾고 있습니다...', delay: 2000 },
      { title: '코드 수정', description: '필요한 코드를 수정하고 있습니다...', delay: 4000 },
      { title: '테스트 실행', description: '수정사항을 테스트하고 있습니다...', delay: 3000 },
      { title: '작업 완료', description: '작업이 성공적으로 완료되었습니다!', delay: 1000 }
    ];

    let stepIndex = 0;

    const processStep = () => {
      if (stepIndex >= steps.length) {
        completeClaudeTask(true);
        return;
      }

      const currentStep = steps[stepIndex];
      
      // 이전 단계 완료 처리
      if (stepIndex > 0) {
        setClaudeSteps(prev => {
          const newSteps = [...prev];
          if (newSteps.length > 0) {
            newSteps[newSteps.length - 1] = { 
              ...newSteps[newSteps.length - 1], 
              status: 'completed' 
            };
          }
          return newSteps;
        });
      }
      
      addClaudeStep(currentStep.title, currentStep.description, 'active');
      
      stepIndex++;
      setTimeout(processStep, currentStep.delay);
    };

    setTimeout(processStep, 1000);
  };

  // Claude 작업 완료
  const completeClaudeTask = (success: boolean) => {
    if (!currentTask) return;

    // 마지막 단계 완료 처리
    setClaudeSteps(prev => {
      const newSteps = [...prev];
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = { 
          ...newSteps[newSteps.length - 1], 
          status: 'completed' 
        };
      }
      return newSteps;
    });

    setClaudeStatus(success ? 'completed' : 'error');
    
    // 작업 상태 업데이트
    setTasks(prev => prev.map(t => 
      t.id === currentTask.id ? { ...t, status: success ? 'completed' : 'failed' } : t
    ));

    // 통계 업데이트
    setStats(prev => ({
      totalTasks: prev.totalTasks + 1,
      successTasks: success ? prev.successTasks + 1 : prev.successTasks,
      failedTasks: !success ? prev.failedTasks + 1 : prev.failedTasks
    }));

    addLog(success ? 'success' : 'error', `작업 ${success ? '완료' : '실패'}: ${currentTask.title}`);
    
    setCurrentTask(null);
    
    // 다음 작업 처리
    if (isLoopRunning) {
      setTimeout(() => processNextTask(), 3000);
    }
  };

  // 명령어 실행
  const executeCommand = () => {
    const cmdToRun = command === 'custom' ? customCommand : command;
    
    if (!cmdToRun) {
      addLog('error', '실행할 명령어를 입력해주세요.');
      return;
    }

    setIsCommandRunning(true);
    addLog('info', `명령어 실행: ${cmdToRun}`);
    addLog('info', `작업 디렉토리: ${projectPath}`);
    
    // 시뮬레이션
    setTimeout(() => {
      addLog('success', '명령어가 성공적으로 실행되었습니다.');
      setIsCommandRunning(false);
    }, 3000);
  };

  // 채팅 전송
  const sendChatMessage = () => {
    if (!chatInput.trim()) return;

    const message = chatInput.trim();
    addChatMessage('user', message);
    setChatInput('');

    // Claude 진행 상황 표시
    startClaudeCommand(message);

    // 응답 시뮬레이션
    setTimeout(() => {
      const response = `"${message}"에 대한 작업을 처리했습니다. 결과를 확인해주세요.`;
      addChatMessage('assistant', response);
    }, 2000);
  };

  // Claude 명령어 처리
  const startClaudeCommand = (message: string) => {
    setClaudeTaskTitle('명령 처리 중...');
    setClaudeStatus('active');
    setClaudeSteps([]);
    
    const command = message.toLowerCase();
    let steps: any[] = [];
    
    if (command.includes('백테스트') || command.includes('전략')) {
      steps = [
        { title: '명령 분석', description: `"${message}" 명령을 분석하고 있습니다...`, delay: 1000 },
        { title: '파일 검색', description: 'StrategySelector.tsx 파일을 찾고 있습니다...', delay: 2000 },
        { title: '코드 분석', description: '백테스트 관련 코드를 검토하고 있습니다...', delay: 2500 },
        { title: '문제 발견', description: '백테스트 버튼이 비활성화된 원인을 찾았습니다!', delay: 2000 },
        { title: '코드 수정', description: '백테스트 기능을 복구하고 있습니다...', delay: 3500 },
        { title: '완료', description: '백테스트 기능이 정상적으로 복구되었습니다!', delay: 1000 }
      ];
    } else {
      steps = [
        { title: '명령 분석', description: `"${message}" 명령을 이해하고 있습니다...`, delay: 1000 },
        { title: '처리 중', description: '요청사항을 처리하고 있습니다...', delay: 2000 },
        { title: '작업 수행', description: '필요한 작업을 수행하고 있습니다...', delay: 2500 },
        { title: '완료', description: '작업이 완료되었습니다!', delay: 500 }
      ];
    }
    
    // 단계별 처리
    let stepIndex = 0;
    
    const processStep = () => {
      if (stepIndex >= steps.length) {
        setClaudeStatus('completed');
        return;
      }
      
      const currentStep = steps[stepIndex];
      
      if (stepIndex > 0) {
        setClaudeSteps(prev => {
          const newSteps = [...prev];
          if (newSteps.length > 0) {
            newSteps[newSteps.length - 1] = { 
              ...newSteps[newSteps.length - 1], 
              status: 'completed' 
            };
          }
          return newSteps;
        });
      }
      
      addClaudeStep(currentStep.title, currentStep.description, 'active');
      
      stepIndex++;
      setTimeout(processStep, currentStep.delay);
    };
    
    setTimeout(processStep, 500);
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    setConnectionStatus('connected');
    addLog('success', 'MCP Loop Client Dashboard가 시작되었습니다.');
    addChatMessage('system', 'Claude 대화창이 초기화되었습니다. 무엇을 도와드릴까요?');
  }, []);

  // 스크롤 자동 이동
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            🤖 MCP Loop Client Dashboard
          </h2>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {connectionStatus === 'connected' ? '연결됨' : '연결 끊김'}
            </span>
            <span className="text-sm text-gray-300">
              실행 시간: {new Date().toLocaleTimeString('ko-KR')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽 패널 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 프로젝트 설정 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">📁 프로젝트 설정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">프로젝트명</label>
                  <input 
                    type="text"
                    value={projectName} 
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">프로젝트 경로</label>
                  <input 
                    type="text"
                    value={projectPath} 
                    onChange={(e) => setProjectPath(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">실행 명령어</label>
                  <select 
                    value={command} 
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="npm run dev" className="bg-gray-700 text-white">npm run dev</option>
                    <option value="npm run build" className="bg-gray-700 text-white">npm run build</option>
                    <option value="npm start" className="bg-gray-700 text-white">npm start</option>
                    <option value="custom" className="bg-gray-700 text-white">사용자 정의</option>
                  </select>
                  {command === 'custom' && (
                    <input 
                      type="text"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 mt-2" 
                      placeholder="사용자 정의 명령어"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={executeCommand} 
                    disabled={isCommandRunning}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md font-medium"
                  >
                    ▶️ 실행
                  </button>
                  <button 
                    disabled={!isCommandRunning}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md font-medium"
                  >
                    ⏹️ 중지
                  </button>
                </div>
              </div>
            </div>

            {/* 작업 생성 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">📝 작업 미션 등록</h3>
              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="작업 제목"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
                <textarea 
                  placeholder="작업 설명"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 h-20 resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={newTask.priority} 
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="high" className="bg-gray-700 text-white">높음</option>
                    <option value="medium" className="bg-gray-700 text-white">보통</option>
                    <option value="low" className="bg-gray-700 text-white">낮음</option>
                  </select>
                  <select 
                    value={newTask.type} 
                    onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="bug" className="bg-gray-700 text-white">버그 수정</option>
                    <option value="feature" className="bg-gray-700 text-white">기능 개발</option>
                    <option value="refactor" className="bg-gray-700 text-white">리팩토링</option>
                    <option value="performance" className="bg-gray-700 text-white">성능 개선</option>
                  </select>
                </div>
                <button 
                  onClick={createTask} 
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                >
                  ➕ 작업 생성
                </button>
              </div>
            </div>

            {/* 루프 제어 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">🔄 루프 제어</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setIsLoopRunning(true);
                    addLog('info', '작업 루프가 시작되었습니다.');
                    processNextTask();
                  }}
                  disabled={isLoopRunning}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md font-medium"
                >
                  ▶️ 시작
                </button>
                <button 
                  onClick={() => {
                    setIsLoopRunning(false);
                    addLog('info', '작업 루프가 중지되었습니다.');
                  }}
                  disabled={!isLoopRunning}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md font-medium"
                >
                  ⏹️ 중지
                </button>
                <button 
                  onClick={() => {
                    setIsPaused(!isPaused);
                    addLog('info', isPaused ? '재개되었습니다.' : '일시정지되었습니다.');
                  }}
                  disabled={!isLoopRunning}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-md font-medium"
                >
                  ⏸️ 일시정지
                </button>
              </div>
            </div>
          </div>

          {/* 중앙 패널 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 실시간 로그 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">📊 실시간 로그</h3>
                <button 
                  onClick={() => setLogs([])}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  🗑️ 지우기
                </button>
              </div>
              <div className="mb-2">
                <select 
                  value={logFilter} 
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="all" className="bg-gray-700 text-white">모든 로그</option>
                  <option value="info" className="bg-gray-700 text-white">정보</option>
                  <option value="warning" className="bg-gray-700 text-white">경고</option>
                  <option value="error" className="bg-gray-700 text-white">오류</option>
                  <option value="success" className="bg-gray-700 text-white">성공</option>
                </select>
              </div>
              <div 
                className="h-[400px] overflow-y-auto bg-gray-900 border border-gray-700 rounded-md p-4 font-mono text-sm"
                ref={logScrollRef}
              >
                {logs
                  .filter(log => logFilter === 'all' || log.level === logFilter)
                  .map(log => (
                    <div key={log.id} className={`mb-2 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      <span className="text-gray-400 text-xs">
                        [{log.timestamp.toLocaleTimeString('ko-KR')}]
                      </span>{' '}
                      {log.message}
                    </div>
                  ))}
              </div>
            </div>

            {/* 통계 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">📈 통계</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.totalTasks}</div>
                  <div className="text-sm text-gray-300">처리된 작업</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.successTasks}</div>
                  <div className="text-sm text-gray-300">성공</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.failedTasks}</div>
                  <div className="text-sm text-gray-300">실패</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {stats.totalTasks > 0 
                      ? Math.round((stats.successTasks / stats.totalTasks) * 100) 
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-300">성공률</div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 현재 작업 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">🔄 현재 작업</h3>
              {currentTask ? (
                <div>
                  <h4 className="font-semibold text-white">{currentTask.title}</h4>
                  <p className="text-sm text-gray-300">{currentTask.description}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">실행 중</span>
                </div>
              ) : (
                <p className="text-gray-300">실행 중인 작업 없음</p>
              )}
            </div>

            {/* Claude 작업 진행 상황 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">🤖 Claude 작업 진행 상황</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{claudeTaskTitle}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    claudeStatus === 'waiting' ? 'bg-gray-600 text-white' :
                    claudeStatus === 'active' ? 'bg-blue-600 text-white' :
                    claudeStatus === 'completed' ? 'bg-green-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {claudeStatus === 'waiting' ? '대기' :
                     claudeStatus === 'active' ? '진행 중' :
                     claudeStatus === 'completed' ? '완료' :
                     '오류'}
                  </span>
                </div>
                <div className="h-[300px] overflow-y-auto">
                  {claudeSteps.length > 0 ? (
                    claudeSteps.map(step => (
                      <div key={step.id} className={`mb-3 p-3 rounded-lg border ${
                        step.status === 'active' ? 'border-blue-500 bg-blue-500/20' :
                        step.status === 'completed' ? 'border-green-500 bg-green-500/20 opacity-70' :
                        'border-red-500 bg-red-500/20'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className="text-lg">
                            {step.status === 'active' ? '⏳' :
                             step.status === 'completed' ? '✅' : '❌'}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-white">{step.title}</div>
                            <div className="text-sm text-gray-300">{step.description}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {step.timestamp.toLocaleTimeString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-300 py-8">
                      작업이 시작되면 여기에 진행 상황이 표시됩니다.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 작업 목록 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex space-x-1 mb-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium">
                  대기 중 ({tasks.filter(t => t.status === 'pending').length})
                </button>
                <button className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium">
                  완료됨 ({tasks.filter(t => t.status === 'completed' || t.status === 'failed').length})
                </button>
              </div>
              <div className="h-[200px] overflow-y-auto">
                {tasks.filter(t => t.status === 'pending').map(task => (
                  <div key={task.id} className="mb-3 p-3 border border-gray-600 bg-gray-700/50 rounded">
                    <h4 className="font-semibold text-white">{task.title}</h4>
                    <p className="text-sm text-gray-300">{task.description}</p>
                    <span className="inline-block mt-2 px-2 py-1 bg-gray-600 text-white text-xs rounded">대기 중</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Claude 대화 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">🤖 Claude 대화</h3>
              <div 
                className="h-[300px] overflow-y-auto mb-4 bg-gray-900 border border-gray-700 rounded-md p-4"
                ref={chatScrollRef}
              >
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`mb-3 ${
                    msg.type === 'user' ? 'text-right' :
                    msg.type === 'system' ? 'text-center' :
                    'text-left'
                  }`}>
                    <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      msg.type === 'user' ? 'bg-blue-600 text-white' :
                      msg.type === 'system' ? 'bg-gray-600 text-gray-200 text-sm' :
                      'bg-gray-700 text-white'
                    }`}>
                      {msg.content}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {msg.timestamp.toLocaleTimeString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="메시지를 입력하세요..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                />
                <button 
                  onClick={sendChatMessage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  📤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}