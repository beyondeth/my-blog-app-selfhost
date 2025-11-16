import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';

/**
 * 이미지 처리 서비스
 *
 * HTML 콘텐츠 내의 이미지를 처리하고 최적화합니다.
 * 이미지 URL 정규화, 지연 로딩, 크기 최적화 등을 수행합니다.
 */
@Injectable()
export class ImageProcessorService {
  /**
   * HTML 내의 이미지를 처리합니다.
   *
   * @param html - 처리할 HTML 문자열
   * @param baseUrl - 상대 URL을 절대 URL로 변환할 때 사용할 기본 URL
   * @returns 처리된 HTML 문자열
   */
  processImages(html: string, baseUrl?: string): string {
    if (!html) return '';

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 모든 img 태그 찾기
      const images = document.querySelectorAll('img');

      images.forEach((img) => {
        // 이미지 URL 정규화
        const src = img.getAttribute('src');
        if (src) {
          const normalizedSrc = this.normalizeImageUrl(src, baseUrl);
          img.setAttribute('src', normalizedSrc);
        }

        // 지연 로딩 추가
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }

        // 디코딩 최적화
        if (!img.hasAttribute('decoding')) {
          img.setAttribute('decoding', 'async');
        }

        // 클릭 가능 마커 추가 (프론트엔드에서 모달 오픈용)
        img.setAttribute('data-clickable', 'true');

        // alt 텍스트가 없으면 빈 문자열이라도 추가 (접근성)
        if (!img.hasAttribute('alt')) {
          img.setAttribute('alt', '');
        }

        // 원본 크기 정보 보존 (있는 경우)
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        if (width) img.setAttribute('data-original-width', width);
        if (height) img.setAttribute('data-original-height', height);
      });

      // figure > img 구조 처리
      const figures = document.querySelectorAll('figure');
      figures.forEach((figure) => {
        const img = figure.querySelector('img');
        const figcaption = figure.querySelector('figcaption');

        if (img) {
          // figure에 이미지 관련 클래스 추가
          figure.classList.add('image-container');

          // 캡션이 있으면 이미지의 title 속성으로도 추가
          if (figcaption) {
            const captionText = figcaption.textContent || '';
            img.setAttribute('title', captionText);
          }
        }
      });

      return document.body.innerHTML;
    } catch (error) {
      console.error('Error processing images:', error);
      return html;
    }
  }

  /**
   * 이미지 URL을 정규화합니다.
   *
   * @param url - 정규화할 URL
   * @param baseUrl - 상대 URL 변환시 사용할 기본 URL
   * @returns 정규화된 URL
   */
  private normalizeImageUrl(url: string, baseUrl?: string): string {
    if (!url) return '';

    // 이미 절대 URL인 경우
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }

    // 프로토콜 상대 URL
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // 상대 URL인 경우
    if (baseUrl) {
      try {
        const base = new URL(baseUrl);
        const absoluteUrl = new URL(url, base);
        return absoluteUrl.toString();
      } catch {
        // URL 파싱 실패시 원본 반환
        return url;
      }
    }

    // 로컬 이미지 경로인 경우 (예: /uploads/...)
    if (url.startsWith('/')) {
      // API URL을 기본으로 사용
      const apiUrl = process.env.API_URL || 'http://localhost:3000';
      return `${apiUrl}${url}`;
    }

    return url;
  }

  
  /**
   * HTML에서 모든 이미지 URL을 추출합니다.
   *
   * @param html - HTML 문자열
   * @returns 이미지 URL 배열
   */
  extractImageUrls(html: string): string[] {
    if (!html) return [];

    const urls: string[] = [];

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          urls.push(src);
        }
      });
    } catch (error) {
      console.error('Error extracting image URLs:', error);
    }

    return urls;
  }

  /**
   * 이미지 통계를 생성합니다.
   *
   * @param html - HTML 문자열
   * @returns 이미지 통계
   */
  getImageStats(html: string): {
    total: number;
    withAlt: number;
    withCaption: number;
    formats: Record<string, number>;
  } {
    const stats = {
      total: 0,
      withAlt: 0,
      withCaption: 0,
      formats: {} as Record<string, number>,
    };

    if (!html) return stats;

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const images = document.querySelectorAll('img');
      stats.total = images.length;

      images.forEach((img) => {
        // Alt 텍스트 확인
        const alt = img.getAttribute('alt');
        if (alt && alt.trim() !== '') {
          stats.withAlt++;
        }

        // 이미지 형식 추출
        const src = img.getAttribute('src');
        if (src) {
          const format = this.extractImageFormat(src);
          if (format) {
            stats.formats[format] = (stats.formats[format] || 0) + 1;
          }
        }
      });

      // 캡션이 있는 이미지 수 계산
      const figuresWithCaption = document.querySelectorAll('figure:has(figcaption)');
      stats.withCaption = figuresWithCaption.length;
    } catch (error) {
      console.error('Error calculating image stats:', error);
    }

    return stats;
  }

  /**
   * URL에서 이미지 형식을 추출합니다.
   *
   * @param url - 이미지 URL
   * @returns 이미지 형식 (jpg, png, gif, webp 등)
   */
  private extractImageFormat(url: string): string | null {
    if (!url) return null;

    // Data URL인 경우
    if (url.startsWith('data:image/')) {
      const match = url.match(/data:image\/([^;]+)/);
      return match ? match[1] : null;
    }

    // 일반 URL인 경우
    const match = url.match(/\.([a-z]+)(\?|#|$)/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * 이미지를 최적화된 picture 요소로 변환합니다.
   *
   * @param html - HTML 문자열
   * @returns picture 요소로 변환된 HTML
   */
  convertToPictureElements(html: string): string {
    if (!html) return '';

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const images = document.querySelectorAll('img:not(picture img)');

      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) return;

        // picture 요소 생성
        const picture = document.createElement('picture');

        // WebP source 추가
        const sourceWebP = document.createElement('source');
        sourceWebP.setAttribute('srcset', src.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
        sourceWebP.setAttribute('type', 'image/webp');
        picture.appendChild(sourceWebP);

        // AVIF source 추가 (더 나은 압축)
        const sourceAVIF = document.createElement('source');
        sourceAVIF.setAttribute('srcset', src.replace(/\.(jpg|jpeg|png)$/i, '.avif'));
        sourceAVIF.setAttribute('type', 'image/avif');
        picture.insertBefore(sourceAVIF, sourceWebP);

        // 원본 img를 picture 안으로 이동
        const imgClone = img.cloneNode(true) as HTMLImageElement;
        picture.appendChild(imgClone);

        // 원본 img를 picture로 교체
        img.parentNode?.replaceChild(picture, img);
      });

      return document.body.innerHTML;
    } catch (error) {
      console.error('Error converting to picture elements:', error);
      return html;
    }
  }
}