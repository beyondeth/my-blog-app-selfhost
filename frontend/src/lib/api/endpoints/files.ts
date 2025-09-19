/**
 * 파일 관련 API 엔드포인트
 * @description S3 파일 업로드/다운로드 및 관리 기능
 */

import type { ApiClient } from '../client';
import type {
  FileUpload,
  CreateUploadUrlDto,
  UploadCompleteDto,
  PresignedUrlResponse,
  FileStats,
  PaginatedResponse
} from '../types';
import { apiLogger } from '@/utils/logger';

/**
 * 파일 조회 파라미터
 */
export interface GetFilesParams {
  fileType?: string;
  page?: number;
  limit?: number;
}

/**
 * 파일 타입 열거형
 */
export type FileType = 'image' | 'document' | 'video' | 'general';

/**
 * 파일 API 클래스
 * @description 파일 업로드/다운로드 관련 모든 API 메서드
 */
export class FilesAPI {
  constructor(private client: ApiClient) {}

  /**
   * S3 업로드를 위한 Presigned URL 생성
   * @param data - 파일 정보
   * @returns Presigned URL 및 파일 키
   * @description S3 직접 업로드를 위한 서명된 URL 생성
   */
  async createUploadUrl(data: CreateUploadUrlDto): Promise<PresignedUrlResponse> {
    return this.client.post<PresignedUrlResponse>('/files/upload-url', data);
  }

  /**
   * 파일 업로드 완료 알림
   * @param data - 업로드 완료 정보
   * @returns 저장된 파일 정보
   * @description S3 업로드 후 DB에 파일 정보 저장
   */
  async uploadComplete(data: UploadCompleteDto): Promise<FileUpload> {
    return this.client.post<FileUpload>('/files/upload-complete', data);
  }

  /**
   * S3에 파일 직접 업로드
   * @param file - 업로드할 파일
   * @param uploadUrl - Presigned URL
   * @description S3에 직접 HTTP PUT 요청으로 파일 업로드
   */
  async uploadFileToS3(file: File, uploadUrl: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`S3 업로드 실패: ${response.statusText}`);
    }
  }

  /**
   * 통합 파일 업로드 메서드
   * @param file - 업로드할 파일
   * @param fileType - 파일 타입
   * @returns 업로드된 파일 정보
   * @description Presigned URL 생성 → S3 업로드 → DB 저장 통합 처리
   */
  async uploadFile(
    file: File,
    fileType: FileType = 'general'
  ): Promise<FileUpload> {
    try {
      apiLogger.debug('파일 업로드 시작', {
        fileName: file.name,
        fileType,
        fileSize: file.size
      });

      // 1. Presigned URL 요청
      const uploadData: CreateUploadUrlDto = {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType,
      };

      const presignedResponse = await this.createUploadUrl(uploadData);
      apiLogger.debug('Presigned URL 생성 완료');

      // 2. S3에 파일 업로드
      await this.uploadFileToS3(file, presignedResponse.uploadUrl);
      apiLogger.debug('S3 업로드 완료');

      // 3. 업로드 완료 알림
      const completeData: UploadCompleteDto = {
        fileKey: presignedResponse.fileKey,
        fileUrl: `https://myblogdata84.s3.us-east-1.amazonaws.com/${presignedResponse.fileKey}`,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileType: fileType
      };

      const result = await this.uploadComplete(completeData);
      apiLogger.debug('파일 업로드 완료');

      return result;
    } catch (error) {
      apiLogger.error('파일 업로드 실패', error);
      throw error;
    }
  }

  /**
   * 사용자의 파일 목록 조회
   * @param params - 조회 파라미터
   * @returns 페이지네이션된 파일 목록
   * @description 로그인한 사용자의 파일만 조회
   */
  async getUserFiles(params?: GetFilesParams): Promise<PaginatedResponse<FileUpload>> {
    return this.client.get<PaginatedResponse<FileUpload>>('/files', { params });
  }

  /**
   * 파일 정보 조회
   * @param id - 파일 ID
   * @returns 파일 상세 정보
   */
  async getFile(id: number): Promise<FileUpload> {
    return this.client.get<FileUpload>(`/files/${id}`);
  }

  /**
   * 파일 다운로드 URL 조회
   * @param id - 파일 ID
   * @returns 임시 다운로드 URL
   * @description S3 Presigned URL (유효 시간 제한)
   */
  async getFileDownloadUrl(id: number): Promise<{ downloadUrl: string }> {
    return this.client.get<{ downloadUrl: string }>(`/files/${id}/download-url`);
  }

  /**
   * 파일 삭제
   * @param id - 파일 ID
   * @description S3 및 DB에서 파일 삭제
   */
  async deleteFile(id: string): Promise<void> {
    await this.client.delete(`/files/${id}`);
  }

  /**
   * 파일 통계 조회
   * @returns 파일 사용 통계
   * @description 총 용량, 파일 수 등 통계 정보
   */
  async getFileStats(): Promise<FileStats> {
    return this.client.get<FileStats>('/files/stats');
  }
}

/**
 * FilesAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns FilesAPI 인스턴스
 */
export function createFilesAPI(client: ApiClient): FilesAPI {
  return new FilesAPI(client);
}