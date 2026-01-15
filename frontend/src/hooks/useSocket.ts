import { useSocketContext } from '@/providers/SocketProvider';

/**
 * WebSocket Hook (Refactored to use Singleton Pattern)
 * 
 * 기존: 컴포넌트마다 new io() 호출 -> 중복 연결 발생
 * 변경: SocketProvider에서 생성된 단일 소켓 인스턴스를 반환
 * 
 * @param enabled - 하위 호환성을 위해 남겨둠 (이제 provider에서 제어하므로 무시됨)
 */
export function useSocket(enabled: boolean = true) {
  const { socket } = useSocketContext();
  
  // enabled가 false면 null 반환 (기존 코드와의 호환성)
  if (!enabled) {
    return null;
  }
  
  return socket;
}