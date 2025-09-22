import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PdfGenerateOptions {
  /** PDF 파일명 */
  filename?: string;
  /** 제목 (파일명 생성용) */
  title?: string;
  /** 진행 상태 콜백 */
  onProgress?: (status: string) => void;
}

/**
 * HTML 요소를 PDF로 변환하여 다운로드
 *
 * @param elementId - PDF로 변환할 HTML 요소의 ID
 * @param options - PDF 생성 옵션
 * @returns 성공/실패 여부
 */
export async function generatePdfFromElement(
  elementId: string,
  options: PdfGenerateOptions = {}
): Promise<boolean> {
  const {
    filename = 'blog-post.pdf',
    title = 'Blog Post',
    onProgress
  } = options;

  // 중복 실행 방지 - window 객체에 플래그 저장
  if ((window as any).__pdfGenerating) {
    console.log('PDF 생성 중입니다. 잠시만 기다려주세요.');
    return false;
  }

  try {
    // PDF 생성 시작 플래그 설정
    (window as any).__pdfGenerating = true;
    // 진행 상태 알림
    onProgress?.('PDF 생성을 준비하는 중...');

    // PDF로 변환할 요소 찾기
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('변환할 요소를 찾을 수 없습니다.');
    }

    // 현재 스크롤 위치 저장 (나중에 복원)
    const currentScrollPosition = window.scrollY;

    // html2canvas 옵션 설정
    onProgress?.('화면을 캡처하는 중...');
    const canvas = await html2canvas(element, {
      scale: 2, // 고화질을 위해 스케일 증가
      useCORS: true, // 외부 이미지 허용
      logging: false, // 로그 비활성화
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      backgroundColor: '#ffffff', // 배경색 흰색
      imageTimeout: 15000, // 이미지 로드 타임아웃
      onclone: (clonedDoc) => {
        // 복제된 문서에서 불필요한 요소 제거
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // PDF용 패딩 조정 - 상하 패딩 제거
          (clonedElement as HTMLElement).style.paddingTop = '0';
          (clonedElement as HTMLElement).style.paddingBottom = '0';

          // 버튼, 드롭다운 등 불필요한 UI 요소 숨기기
          const buttonsToHide = clonedElement.querySelectorAll('[data-pdf-hide="true"]');
          buttonsToHide.forEach(btn => {
            (btn as HTMLElement).style.display = 'none';
          });
        }
      }
    });

    // PDF 생성
    onProgress?.('PDF를 생성하는 중...');

    // A4 사이즈로 PDF 생성 (여백 설정)
    const marginHorizontal = 20; // 좌우 여백 20mm
    const marginVertical = 28; // 상하 여백 20mm
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const contentWidth = pageWidth - (marginHorizontal * 2);
    const contentHeight = pageHeight - (marginVertical * 2);

    // PDF 문서 생성
    const pdf = new jsPDF('p', 'mm', 'a4');

    // 캔버스를 PDF 크기에 맞게 조정
    const pdfWidthInPixels = contentWidth;
    const scale = pdfWidthInPixels / (canvas.width / 2); // scale 2를 고려
    const pdfHeightInPixels = (canvas.height / 2) * scale;

    // 페이지당 표시할 픽셀 높이 계산
    const pixelsPerPage = contentHeight / scale;

    // 총 페이지 수 계산
    const totalPages = Math.ceil((canvas.height / 2) / pixelsPerPage);

    // 각 페이지 처리
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      // 새 페이지 추가 (첫 페이지 제외)
      if (pageNum > 0) {
        pdf.addPage();
      }

      // 현재 페이지에 표시할 캔버스 영역 계산
      const sourceY = pageNum * pixelsPerPage * 2; // scale 2를 고려
      const sourceHeight = Math.min(pixelsPerPage * 2, canvas.height - sourceY);

      // 임시 캔버스 생성 - 이 페이지의 내용만 담기
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = sourceHeight;
      const tempCtx = tempCanvas.getContext('2d');

      if (tempCtx) {
        // 원본 캔버스에서 현재 페이지 부분만 복사
        tempCtx.drawImage(
          canvas,
          0, sourceY,           // source x, y
          canvas.width, sourceHeight,  // source width, height
          0, 0,                        // destination x, y
          canvas.width, sourceHeight   // destination width, height
        );

        // 임시 캔버스를 이미지로 변환
        const pageImageData = tempCanvas.toDataURL('image/jpeg', 0.85);

        // 실제 그려질 높이 계산 (PDF 단위)
        const drawHeight = Math.min(contentHeight, (sourceHeight / 2) * scale);

        // PDF에 이미지 추가 - 정확한 여백 위치에
        pdf.addImage(
          pageImageData,
          'JPEG',
          marginHorizontal,
          marginVertical,
          contentWidth,
          drawHeight,
          undefined,
          'FAST'
        );

        // 메모리 정리
        tempCanvas.remove();
      }
    }

    // PDF 다운로드
    onProgress?.('PDF를 다운로드하는 중...');

    // 파일명 생성 (제목 기반 또는 기본값)
    const sanitizedTitle = title
      .replace(/[^a-z0-9가-힣\s-]/gi, '') // 특수문자 제거
      .replace(/\s+/g, '-') // 공백을 하이픈으로
      .toLowerCase();

    const finalFilename = filename || `${sanitizedTitle}-${new Date().toISOString().split('T')[0]}.pdf`;

    // PDF 저장
    pdf.save(finalFilename);

    // 스크롤 위치 복원
    window.scrollTo(0, currentScrollPosition);

    // 메모리 정리
    canvas.remove();

    onProgress?.('PDF 다운로드 완료!');
    return true;

  } catch (error) {
    // 에러 로그만 남기고 조용히 실패 처리
    console.error('PDF 생성 중 오류 발생:', error);

    // 사용자에게 알리지 않고 false 반환
    return false;

  } finally {
    // 플래그 해제 - 에러가 나든 성공하든 항상 해제
    (window as any).__pdfGenerating = false;
  }
}

/**
 * 포스트를 PDF로 다운로드
 *
 * @param postTitle - 포스트 제목
 * @param onProgress - 진행 상태 콜백
 * @returns 성공/실패 여부
 */
export async function downloadPostAsPdf(
  postTitle: string,
  onProgress?: (status: string) => void
): Promise<boolean> {
  return generatePdfFromElement('post-content', {
    title: postTitle,
    filename: `${postTitle}-${new Date().toISOString().split('T')[0]}.pdf`,
    onProgress
  });
}