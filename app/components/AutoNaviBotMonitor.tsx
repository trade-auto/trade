'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Badge, 
  Progress, 
  Divider,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Grid,
  GridItem,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Flex,
  Icon
} from '@chakra-ui/react';
import { FiActivity, FiClock, FiCheckCircle, FiXCircle, FiPlay } from 'react-icons/fi';

interface TaskData {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: number;
  progress?: number;
  duration?: number;
  error?: string;
}

interface SystemStatus {
  isRunning: boolean;
  clientCount: number;
  stats: {
    totalConnections: number;
    currentConnections: number;
    messagesReceived: number;
    messagesSent: number;
    uptime: number;
  };
}

interface MonitoringData {
  type: string;
  data: any;
  timestamp: string;
}

/**
 * AutoNaviBotClaude 실시간 모니터링 컴포넌트
 * autonavibotclaude_mcp의 실시간 상태를 표시합니다.
 */
export function AutoNaviBotMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [currentTasks, setCurrentTasks] = useState<TaskData[]>([]);
  const [completionRate, setCompletionRate] = useState(0);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  
  const toast = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);

  /**
   * WebSocket 연결 설정
   */
  const connectWebSocket = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    try {
      const websocket = new WebSocket('ws://localhost:8083');
      
      websocket.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setErrors([]);
        
        // 구독 설정
        websocket.send(JSON.stringify({
          type: 'subscribe',
          data: {
            events: ['task-updates', 'task-events', 'system-updates', 'statistics']
          }
        }));

        // 현재 상태 요청
        websocket.send(JSON.stringify({
          type: 'request-status'
        }));

        toast({
          title: '✅ AutoNaviBotClaude 연결됨',
          description: '실시간 모니터링이 시작되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      };

      websocket.onmessage = (event) => {
        try {
          const message: MonitoringData = JSON.parse(event.data);
          handleWebSocketMessage(message);
          setLastActivity(new Date());
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      websocket.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (event.code !== 1000) { // 정상 종료가 아닌 경우
          const errorMsg = `연결 끊어짐 (코드: ${event.code})`;
          setErrors(prev => [...prev.slice(-4), errorMsg]); // 최근 5개만 유지
          
          // 자동 재연결 시도
          setTimeout(() => {
            if (connectionStatus !== 'connected') {
              connectWebSocket();
            }
          }, 5000);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        const errorMsg = 'WebSocket 연결 오류 발생';
        setErrors(prev => [...prev.slice(-4), errorMsg]);
        
        toast({
          title: '❌ 연결 오류',
          description: 'AutoNaviBotClaude 서버에 연결할 수 없습니다.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      };

      setWs(websocket);
      
    } catch (error) {
      console.error('WebSocket 초기화 오류:', error);
      setConnectionStatus('disconnected');
    }
  }, [ws, connectionStatus, toast]);

  /**
   * WebSocket 메시지 처리
   */
  const handleWebSocketMessage = useCallback((message: MonitoringData) => {
    switch (message.type) {
      case 'connection-established':
        setSystemStatus(message.data.serverStatus);
        break;

      case 'status-update':
        setSystemStatus(message.data.serverStatus);
        break;

      case 'task-update':
        handleTaskUpdate(message.data);
        break;

      case 'task-completed':
        handleTaskCompleted(message.data);
        break;

      case 'task-failed':
        handleTaskFailed(message.data);
        break;

      case 'system-status':
        setSystemStatus(message.data);
        break;

      case 'statistics':
        handleStatistics(message.data);
        break;

      case 'server-shutdown':
        toast({
          title: '⚠️ 서버 종료',
          description: 'AutoNaviBotClaude 서버가 종료되었습니다.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        break;
    }
  }, [toast]);

  /**
   * 작업 업데이트 처리
   */
  const handleTaskUpdate = useCallback((taskData: TaskData) => {
    setCurrentTasks(prev => {
      const index = prev.findIndex(task => task.id === taskData.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...taskData };
        return updated;
      } else {
        return [...prev, taskData];
      }
    });
  }, []);

  /**
   * 작업 완료 처리
   */
  const handleTaskCompleted = useCallback((taskData: TaskData) => {
    handleTaskUpdate({ ...taskData, status: 'completed' });
    
    toast({
      title: '✅ 작업 완료',
      description: `${taskData.name}`,
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
  }, [handleTaskUpdate, toast]);

  /**
   * 작업 실패 처리
   */
  const handleTaskFailed = useCallback((taskData: TaskData & { error?: string }) => {
    handleTaskUpdate({ ...taskData, status: 'failed' });
    
    toast({
      title: '❌ 작업 실패',
      description: `${taskData.name}: ${taskData.error || '알 수 없는 오류'}`,
      status: 'error',
      duration: 6000,
      isClosable: true,
    });
  }, [handleTaskUpdate, toast]);

  /**
   * 통계 처리
   */
  const handleStatistics = useCallback((statsData: any) => {
    if (statsData.completionRate !== undefined) {
      setCompletionRate(statsData.completionRate);
    }
  }, []);

  /**
   * 시간 포맷팅
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  /**
   * 상태 색상 결정
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'failed': return 'red';
      case 'pending': return 'yellow';
      default: return 'gray';
    }
  };

  // 컴포넌트 마운트 시 WebSocket 연결
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, []);

  // 통계 계산
  const taskStats = currentTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box p={6} bg="gray.50" borderRadius="lg" minH="600px">
      <VStack spacing={6} align="stretch">
        {/* 헤더 */}
        <Flex justify="space-between" align="center">
          <HStack>
            <Icon as={FiActivity} boxSize={6} color="blue.500" />
            <Text fontSize="2xl" fontWeight="bold">AutoNaviBotClaude Monitor</Text>
            <Badge 
              colorScheme={isConnected ? 'green' : 'red'} 
              variant="subtle"
              px={3}
              py={1}
            >
              {connectionStatus === 'connecting' ? '연결 중...' : 
               connectionStatus === 'connected' ? '온라인' : '오프라인'}
            </Badge>
          </HStack>
          
          <Button 
            size="sm" 
            colorScheme="blue" 
            onClick={connectWebSocket}
            disabled={isConnected}
            leftIcon={<Icon as={FiPlay} />}
          >
            {isConnected ? '연결됨' : '연결'}
          </Button>
        </Flex>

        <Divider />

        {/* 연결 오류 표시 */}
        {errors.length > 0 && (
          <Alert status="warning">
            <AlertIcon />
            <AlertTitle>연결 문제:</AlertTitle>
            <AlertDescription>{errors[errors.length - 1]}</AlertDescription>
          </Alert>
        )}

        {/* 시스템 상태 */}
        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>전체 완료율</StatLabel>
                  <StatNumber color={completionRate >= 90 ? 'green.500' : 'orange.500'}>
                    {completionRate.toFixed(1)}%
                  </StatNumber>
                  <StatHelpText>목표: 90% 이상</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>현재 작업 수</StatLabel>
                  <StatNumber>{currentTasks.length}</StatNumber>
                  <StatHelpText>
                    완료: {taskStats.completed || 0} | 
                    진행: {taskStats.in_progress || 0} | 
                    실패: {taskStats.failed || 0}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>서버 연결</StatLabel>
                  <StatNumber>{systemStatus?.stats.currentConnections || 0}</StatNumber>
                  <StatHelpText>
                    업타임: {systemStatus?.stats.uptime ? formatDuration(systemStatus.stats.uptime) : '-'}
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>마지막 활동</StatLabel>
                  <StatNumber fontSize="lg">
                    <Icon as={FiClock} mr={2} />
                    {lastActivity ? lastActivity.toLocaleTimeString() : '-'}
                  </StatNumber>
                  <StatHelpText>실시간 업데이트</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* 전체 진행률 바 */}
        <Box>
          <Text fontSize="sm" mb={2} fontWeight="semibold">전체 진행률</Text>
          <Progress 
            value={completionRate} 
            colorScheme={completionRate >= 90 ? 'green' : completionRate >= 70 ? 'blue' : 'orange'}
            hasStripe
            isAnimated={taskStats.in_progress > 0}
            height="20px"
            borderRadius="md"
          />
          <Text fontSize="xs" color="gray.600" mt={1}>
            {completionRate >= 90 ? '🎯 목표 달성!' : '📈 진행 중...'}
          </Text>
        </Box>

        {/* 현재 작업 목록 */}
        <Box>
          <Text fontSize="lg" fontWeight="semibold" mb={3}>현재 작업 상황</Text>
          {currentTasks.length === 0 ? (
            <Card>
              <CardBody textAlign="center" py={8}>
                <Text color="gray.500">진행 중인 작업이 없습니다.</Text>
              </CardBody>
            </Card>
          ) : (
            <VStack spacing={3} align="stretch">
              {currentTasks.slice(0, 10).map((task) => (
                <Card key={task.id} variant={task.status === 'in_progress' ? 'elevated' : 'outline'}>
                  <CardBody py={3}>
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1} flex={1}>
                        <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
                          {task.name}
                        </Text>
                        {task.progress !== undefined && (
                          <Progress value={task.progress} size="sm" width="200px" />
                        )}
                      </VStack>
                      
                      <HStack spacing={2}>
                        {task.duration && (
                          <Text fontSize="xs" color="gray.600">
                            {formatDuration(task.duration)}
                          </Text>
                        )}
                        <Badge 
                          colorScheme={getStatusColor(task.status)}
                          variant="subtle"
                          size="sm"
                        >
                          <Icon 
                            as={
                              task.status === 'completed' ? FiCheckCircle :
                              task.status === 'failed' ? FiXCircle :
                              FiPlay
                            } 
                            mr={1} 
                          />
                          {task.status}
                        </Badge>
                      </HStack>
                    </HStack>
                    
                    {task.error && (
                      <Text fontSize="xs" color="red.500" mt={2}>
                        오류: {task.error}
                      </Text>
                    )}
                  </CardBody>
                </Card>
              ))}
            </VStack>
          )}
        </Box>

        {/* 시스템 정보 */}
        {systemStatus && (
          <Box>
            <Text fontSize="lg" fontWeight="semibold" mb={3}>시스템 정보</Text>
            <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={3}>
              <Text fontSize="sm">
                <strong>메시지 수신:</strong> {systemStatus.stats.messagesReceived.toLocaleString()}
              </Text>
              <Text fontSize="sm">
                <strong>메시지 송신:</strong> {systemStatus.stats.messagesSent.toLocaleString()}
              </Text>
              <Text fontSize="sm">
                <strong>총 연결 수:</strong> {systemStatus.stats.totalConnections}
              </Text>
              <Text fontSize="sm">
                <strong>현재 연결:</strong> {systemStatus.stats.currentConnections}
              </Text>
            </Grid>
          </Box>
        )}
      </VStack>
    </Box>
  );
}

export default AutoNaviBotMonitor;