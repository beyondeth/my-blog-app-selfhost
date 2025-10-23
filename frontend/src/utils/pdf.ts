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

    // 콘텐츠 크기 확인 및 동적 스케일 계산
    const contentHeight = element.scrollHeight;
    const contentWidth = element.scrollWidth;

    // 브라우저 Canvas 안전 제한 (실제 제한보다 여유있게)
    const MAX_CANVAS_HEIGHT = 30000;
    const MAX_CANVAS_WIDTH = 30000;

    // 동적 스케일 계산
    let scale = 2; // 기본값: 고화질

    // Canvas 높이 제한 체크
    if (contentHeight * scale > MAX_CANVAS_HEIGHT) {
      scale = Math.floor((MAX_CANVAS_HEIGHT / contentHeight) * 10) / 10;
      scale = Math.max(scale, 1.5); // 최소 1.5 (화질 유지하되 유연성 확보)
      console.log(`긴 콘텐츠 감지: Scale을 ${scale}로 조정합니다.`);
    }

    // Canvas 너비 제한 체크
    if (contentWidth * scale > MAX_CANVAS_WIDTH) {
      const widthScale = Math.floor((MAX_CANVAS_WIDTH / contentWidth) * 10) / 10;
      scale = Math.min(scale, widthScale);
      scale = Math.max(scale, 1.5); // 최소 1.5
      console.log(`넓은 콘텐츠 감지: Scale을 ${scale}로 조정합니다.`);
    }

    // Canvas 총 면적 제한 체크 (브라우저별 픽셀 제한)
    const totalPixels = (contentWidth * scale) * (contentHeight * scale);
    const CHROME_LIMIT = 268435456; // Chrome 최대 픽셀
    const SAFARI_LIMIT = 16777216;  // Safari 최대 픽셀 (가장 엄격)

    if (totalPixels > SAFARI_LIMIT) {
      // Safari 기준으로 scale 재계산 (가장 안전)
      const safeScale = Math.sqrt(SAFARI_LIMIT / (contentWidth * contentHeight));
      scale = Math.min(scale, Math.floor(safeScale * 10) / 10);
      scale = Math.max(scale, 1); // 최소 1
      console.log(`Canvas 면적 제한: Scale을 ${scale}로 조정합니다. (총 픽셀: ${Math.round(totalPixels / 1000000)}M)`);
    }

    // html2canvas 옵션 설정
    if (scale < 1.5) {
      onProgress?.(`긴 콘텐츠를 처리 중입니다 (화질: ${Math.round(scale * 50)}%)...`);
    } else {
      onProgress?.('화면을 캡처하는 중...');
    }

    const canvas = await html2canvas(element, {
      scale: scale, // 동적으로 계산된 스케일 적용
      useCORS: true, // 외부 이미지 허용
      logging: false, // 로그 비활성화
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      backgroundColor: '#ffffff', // 배경색 흰색
      imageTimeout: contentHeight > 15000 ? 30000 : 15000, // 긴 콘텐츠는 타임아웃 증가
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

    // Canvas 유효성 검사 (검은 화면 방지)
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.error('Canvas 생성 실패:', {
        exists: !!canvas,
        width: canvas?.width,
        height: canvas?.height,
        contentWidth,
        contentHeight,
        scale
      });
      throw new Error('Canvas 생성에 실패했습니다. 콘텐츠가 너무 크거나 브라우저 제한을 초과했을 수 있습니다.');
    }

    // 디버그 로깅
    console.log('PDF 생성 정보:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      totalPixels: canvas.width * canvas.height,
      scale: scale,
      contentWidth,
      contentHeight
    });

    // PDF 생성
    onProgress?.('PDF를 생성하는 중...');

    // A4 사이즈로 PDF 생성 (여백 설정)
    const marginHorizontal = 20; // 좌우 여백 20mm
    const marginVertical = 28; // 상하 여백 28mm
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const contentWidthMM = pageWidth - (marginHorizontal * 2);
    const contentHeightMM = pageHeight - (marginVertical * 2);

    // PDF 문서 생성
    const pdf = new jsPDF('p', 'mm', 'a4');

    // 캔버스를 PDF 크기에 맞게 조정 (동적 scale 사용)
    const pdfScale = contentWidthMM / (canvas.width / scale);
    const pdfHeightInPixels = (canvas.height / scale) * pdfScale;

    // 페이지당 표시할 픽셀 높이 계산
    const pixelsPerPage = contentHeightMM / pdfScale;

    // 총 페이지 수 계산
    const totalPages = Math.ceil((canvas.height / scale) / pixelsPerPage);

    // 각 페이지 처리
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      // 새 페이지 추가 (첫 페이지 제외)
      if (pageNum > 0) {
        pdf.addPage();
      }

      // 현재 페이지에 표시할 캔버스 영역 계산 (동적 scale 사용)
      const sourceY = pageNum * pixelsPerPage * scale;
      const sourceHeight = Math.min(pixelsPerPage * scale, canvas.height - sourceY);

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

        // 임시 캔버스를 이미지로 변환 (95% 고품질)
        const pageImageData = tempCanvas.toDataURL('image/jpeg', 0.95);

        // 실제 그려질 높이 계산 (PDF 단위, 동적 scale 사용)
        const drawHeight = Math.min(contentHeightMM, (sourceHeight / scale) * pdfScale);

        // PDF에 이미지 추가 - 정확한 여백 위치에
        pdf.addImage(
          pageImageData,
          'JPEG',
          marginHorizontal,
          marginVertical,
          contentWidthMM,
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