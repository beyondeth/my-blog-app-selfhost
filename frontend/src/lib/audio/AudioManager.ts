/**
 * AudioManager - 싱글톤 오디오 관리자
 * 엔터프라이즈급 설계 - 메모리 누수 방지, 페이지 이동 간 재생 유지
 *
 * 핵심 기능:
 * - 단일 Audio 인스턴스로 전체 앱에서 음악 재생 관리
 * - 이벤트 리스너 추적 및 자동 정리
 * - 페이지 이동 시에도 재생 유지
 * - 에러 복구 메커니즘
 */

import type { AudioError, AudioErrorCode } from '@/types/music';

// ============================================
// 타입 정의
// ============================================

type AudioEventType =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'loadedmetadata'
  | 'canplay'
  | 'waiting'
  | 'error'
  | 'volumechange'
  | 'seeking'
  | 'seeked';

type AudioEventCallback = (event: Event) => void;

interface AudioEventEntry {
  callback: AudioEventCallback;
  once: boolean;
}

// ============================================
// 상수 정의
// ============================================

// 에러 코드 매핑 (MediaError.code -> AudioErrorCode)
const ERROR_CODE_MAP: Record<number, AudioErrorCode> = {
  1: 'NETWORK', // MEDIA_ERR_ABORTED - 사용자가 중단 (네트워크 문제로 처리)
  2: 'NETWORK', // MEDIA_ERR_NETWORK - 네트워크 에러
  3: 'DECODE', // MEDIA_ERR_DECODE - 디코딩 에러
  4: 'NOT_FOUND', // MEDIA_ERR_SRC_NOT_SUPPORTED - 지원하지 않는 형식
};

// 재시도 설정
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// AudioManager 클래스
// ============================================

class AudioManager {
  private static instance: AudioManager | null = null;

  private audio: HTMLAudioElement | null = null;
  private eventListeners: Map<AudioEventType, Set<AudioEventEntry>> = new Map();
  private isInitialized = false;
  private currentSrc = '';
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // 싱글톤 - private 생성자
  private constructor() {
    // 브라우저 환경에서만 초기화
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * 오디오 인스턴스 초기화
   */
  private initialize(): void {
    if (this.isInitialized) return;

    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // 기본 이벤트 핸들러 등록
    this.setupInternalListeners();

    this.isInitialized = true;
  }

  /**
   * 내부 이벤트 리스너 설정
   */
  private setupInternalListeners(): void {
    if (!this.audio) return;

    // 에러 핸들링
    this.audio.addEventListener('error', () => {
      this.handleError();
    });

    // 재생 종료 시 재시도 카운터 리셋
    this.audio.addEventListener('ended', () => {
      this.retryCount = 0;
    });

    // 성공적으로 재생 시작하면 재시도 카운터 리셋
    this.audio.addEventListener('canplay', () => {
      this.retryCount = 0;
    });
  }

  /**
   * 에러 처리 및 재시도
   */
  private handleError(): void {
    if (!this.audio) return;

    const mediaError = this.audio.error;
    const errorCode = mediaError?.code ?? 0;

    // 자동 재생 차단 감지
    if (errorCode === 0 && !this.audio.paused) {
      // 자동 재생이 차단된 경우
      this.dispatchError({
        code: 'AUTOPLAY_BLOCKED',
        message: '자동 재생이 차단되었습니다. 재생 버튼을 클릭해주세요.',
      });
      return;
    }

    // 재시도 로직
    if (this.retryCount < MAX_RETRY_COUNT && this.currentSrc) {
      this.retryCount++;
      this.retryTimeoutId = setTimeout(() => {
        this.loadSource(this.currentSrc);
      }, RETRY_DELAY_MS * this.retryCount);
      return;
    }

    // 최종 에러 발생
    const audioErrorCode: AudioErrorCode = ERROR_CODE_MAP[errorCode] ?? 'UNKNOWN';
    const errorMessages: Record<AudioErrorCode, string> = {
      NETWORK: '네트워크 오류가 발생했습니다.',
      DECODE: '오디오 파일을 재생할 수 없습니다.',
      NOT_FOUND: '오디오 파일을 찾을 수 없습니다.',
      AUTOPLAY_BLOCKED: '자동 재생이 차단되었습니다.',
      UNKNOWN: '알 수 없는 오류가 발생했습니다.',
    };

    this.dispatchError({
      code: audioErrorCode,
      message: errorMessages[audioErrorCode],
    });
  }

  /**
   * 에러 이벤트 발생
   */
  private dispatchError(error: AudioError): void {
    // 커스텀 에러 이벤트 발생
    const event = new CustomEvent('audioerror', { detail: error });
    this.audio?.dispatchEvent(event);

    // 등록된 error 리스너에게 전달
    this.dispatchToListeners('error', event);
  }

  /**
   * 등록된 리스너들에게 이벤트 전달
   */
  private dispatchToListeners(type: AudioEventType, event: Event): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const toRemove: AudioEventEntry[] = [];

    listeners.forEach((entry) => {
      entry.callback(event);
      if (entry.once) {
        toRemove.push(entry);
      }
    });

    // once 리스너 제거
    toRemove.forEach((entry) => listeners.delete(entry));
  }

  // ============================================
  // 공개 API
  // ============================================

  /**
   * 오디오 소스 로드
   * 동일 URL이면 스킵하여 불필요한 재로드 방지
   */
  public loadSource(src: string): void {
    if (!this.audio) {
      this.initialize();
    }

    if (!this.audio) return;

    // 동일 URL이면 스킵 (페이지 이동 시 음악 끊김 방지)
    if (this.currentSrc === src) {
      return;
    }

    // 기존 재시도 취소
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.currentSrc = src;
    this.retryCount = 0;
    this.audio.src = src;
    this.audio.load();
  }

  /**
   * 재생
   */
  public async play(): Promise<void> {
    if (!this.audio) return;

    try {
      await this.audio.play();
    } catch (error) {
      // DOMException: play() 요청이 pause() 호출로 인해 중단됨
      // 이 경우는 정상적인 사용자 상호작용이므로 무시
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      // NotAllowedError: 자동 재생 차단
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.dispatchError({
          code: 'AUTOPLAY_BLOCKED',
          message: '자동 재생이 차단되었습니다. 재생 버튼을 클릭해주세요.',
        });
        return;
      }

      throw error;
    }
  }

  /**
   * 일시정지
   */
  public pause(): void {
    this.audio?.pause();
  }

  /**
   * 정지 (처음으로 되돌림)
   */
  public stop(): void {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  /**
   * 볼륨 설정 (0-1)
   */
  public setVolume(volume: number): void {
    if (!this.audio) return;

    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 볼륨 가져오기
   */
  public getVolume(): number {
    return this.audio?.volume ?? 0.7;
  }

  /**
   * 음소거 설정
   */
  public setMuted(muted: boolean): void {
    if (!this.audio) return;

    this.audio.muted = muted;
  }

  /**
   * 음소거 상태 가져오기
   */
  public getMuted(): boolean {
    return this.audio?.muted ?? false;
  }

  /**
   * 재생 위치 설정
   */
  public seek(time: number): void {
    if (!this.audio) return;

    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
  }

  /**
   * 현재 재생 시간 가져오기
   */
  public getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  /**
   * 총 재생 시간 가져오기
   */
  public getDuration(): number {
    return this.audio?.duration ?? 0;
  }

  /**
   * 재생 중 여부
   */
  public isPlaying(): boolean {
    return this.audio ? !this.audio.paused && !this.audio.ended : false;
  }

  /**
   * 현재 소스 URL
   */
  public getCurrentSrc(): string {
    return this.currentSrc;
  }

  // ============================================
  // 이벤트 리스너 관리 (메모리 누수 방지 핵심)
  // ============================================

  /**
   * 이벤트 리스너 등록
   * @returns 리스너 제거 함수 (cleanup에서 사용)
   */
  public addEventListener(
    type: AudioEventType,
    callback: AudioEventCallback,
    options?: { once?: boolean }
  ): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    const entry: AudioEventEntry = {
      callback,
      once: options?.once ?? false,
    };

    this.eventListeners.get(type)!.add(entry);

    // 실제 Audio 요소에도 리스너 등록
    if (this.audio) {
      this.audio.addEventListener(type, callback, options);
    }

    // 제거 함수 반환 (React useEffect cleanup에서 사용)
    return () => {
      this.removeEventListener(type, callback);
    };
  }

  /**
   * 이벤트 리스너 제거
   */
  public removeEventListener(type: AudioEventType, callback: AudioEventCallback): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    // Set에서 해당 callback을 가진 entry 찾아서 제거
    listeners.forEach((entry) => {
      if (entry.callback === callback) {
        listeners.delete(entry);
      }
    });

    // 실제 Audio 요소에서도 리스너 제거
    if (this.audio) {
      this.audio.removeEventListener(type, callback);
    }
  }

  /**
   * 특정 타입의 모든 리스너 제거
   */
  public removeAllListeners(type?: AudioEventType): void {
    if (type) {
      const listeners = this.eventListeners.get(type);
      if (listeners && this.audio) {
        listeners.forEach((entry) => {
          this.audio!.removeEventListener(type, entry.callback);
        });
      }
      this.eventListeners.delete(type);
    } else {
      // 모든 리스너 제거
      this.eventListeners.forEach((listeners, eventType) => {
        if (this.audio) {
          listeners.forEach((entry) => {
            this.audio!.removeEventListener(eventType, entry.callback);
          });
        }
      });
      this.eventListeners.clear();
    }
  }

  /**
   * 등록된 리스너 개수 (디버깅용)
   */
  public getListenerCount(type?: AudioEventType): number {
    if (type) {
      return this.eventListeners.get(type)?.size ?? 0;
    }

    let count = 0;
    this.eventListeners.forEach((listeners) => {
      count += listeners.size;
    });
    return count;
  }

  // ============================================
  // 리소스 정리
  // ============================================

  /**
   * 완전 초기화 (앱 종료 시 호출)
   * 주의: 일반적으로 호출할 필요 없음 - 싱글톤이므로 앱 생명주기와 함께함
   */
  public destroy(): void {
    // 재시도 타이머 정리
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    // 모든 리스너 제거
    this.removeAllListeners();

    // 오디오 정리
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    this.isInitialized = false;
    this.currentSrc = '';
    this.retryCount = 0;

    AudioManager.instance = null;
  }
}

// ============================================
// 내보내기
// ============================================

// 싱글톤 인스턴스 getter
export const getAudioManager = (): AudioManager => AudioManager.getInstance();

// 타입 내보내기
export type { AudioEventType, AudioEventCallback };

// 기본 내보내기
export default AudioManager;
