import { useState, useCallback } from 'react';

interface ModalData {
  type: 'image' | 'mermaid';
  content: string; // image는 src URL, mermaid는 SVG string
  alt?: string;
  title?: string;
}

interface UseModalReturn {
  modalData: ModalData | null;
  isModalOpen: boolean;
  openModal: (data: ModalData) => void;
  closeModal: () => void;
  handleImageClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleMermaidClick: (svg: string, content: string) => void;
}

/**
 * 통합 모달 상태와 이벤트 처리를 관리하는 커스텀 훅
 * 이미지와 Mermaid 다이어그램 모달을 모두 처리
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

    // 이미지 클릭 확인
    if (target.tagName === 'IMG' && target.dataset.clickable === 'true') {
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

  // Mermaid 다이어그램 클릭 처리
  const handleMermaidClick = useCallback((svg: string, content: string) => {
    openModal({
      type: 'mermaid',
      content: svg,
      alt: 'Mermaid 다이어그램',
      title: 'Mermaid 다이어그램'
    });
  }, [openModal]);

  return {
    modalData,
    isModalOpen: !!modalData,
    openModal,
    closeModal,
    handleImageClick,
    handleMermaidClick
  };
}