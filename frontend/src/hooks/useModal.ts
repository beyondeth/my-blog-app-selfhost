import { useState, useCallback } from 'react';

interface ModalData {
  type: 'image' | 'diagram';
  content: string; // image는 src URL, diagram은 SVG string
  alt?: string;
  title?: string;
}

interface UseModalReturn {
  modalData: ModalData | null;
  isModalOpen: boolean;
  openModal: (data: ModalData) => void;
  closeModal: () => void;
  handleImageClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleDiagramClick: (svg: string, title?: string) => void;
}

/**
 * 통합 모달 상태와 이벤트 처리를 관리하는 커스텀 훅
 * 이미지와 SVG 다이어그램 모달을 모두 처리
 *
 * @returns 모달 상태와 핸들러들
 */
export function useModal(): UseModalReturn {
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const openModal = useCallback((data: ModalData) => {
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setModalData(null);
  }, []);

  // React 이벤트 위임을 활용한 이미지 클릭 처리
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    // 이미지 클릭 확인 (모든 이미지 클릭 가능)
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();

      const imgElement = target as HTMLImageElement;
      openModal({
        type: 'image',
        content: imgElement.src,
        alt: imgElement.alt || '이미지',
        title: imgElement.title || imgElement.alt || '이미지'
      });
    }
  }, [openModal]);

  // SVG 다이어그램 클릭 처리
  const handleDiagramClick = useCallback((svg: string, title = '다이어그램') => {
    openModal({
      type: 'diagram',
      content: svg,
      alt: title,
      title,
    });
  }, [openModal]);

  return {
    modalData,
    isModalOpen: !!modalData,
    openModal,
    closeModal,
    handleImageClick,
    handleDiagramClick
  };
}
