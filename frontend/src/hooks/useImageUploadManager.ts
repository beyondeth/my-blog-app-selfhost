import { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { UploadedImageInfo } from '@/components/posts/ImageUploadManager';
import { useEditorImageMonitor } from './useEditorImageMonitor';

interface UseImageUploadManagerProps {
  editor: Editor | null;
  images: UploadedImageInfo[]; // 상태를 props로 받음
  onImagesChange: (images: UploadedImageInfo[]) => void; // 이미지 목록 전체를 부모에게 알림
  onThumbnailSelect: (thumbnailId: string) => void;
  selectedThumbnailId: string;
}

export function useImageUploadManager({ 
  editor, 
  images, 
  onImagesChange,
  onThumbnailSelect,
  selectedThumbnailId,
}: UseImageUploadManagerProps) {
  // 부모로부터 받은 상태를 사용하므로 내부 상태 제거
  // const [uploadedImages, setUploadedImages] = useState<UploadedImageInfo[]>([]);
  // const [selectedThumbnailId, setSelectedThumbnailId] = useState<string>('');
  
  const editorImagePositions = useRef<Map<string, number>>(new Map());
  
  // Use refs to avoid circular dependency issues
  const removeImageFromEditorRef = useRef<(imageUrl: string) => boolean>();
  const updateAllEditorImagesRef = useRef<(images: UploadedImageInfo[]) => void>();
  
  // Sync lock to prevent infinite loops between editor and gallery
  const syncSourceRef = useRef<'editor' | 'gallery' | null>(null);
  const syncLockTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Helper function to acquire sync lock
  const acquireSyncLock = useCallback((source: 'editor' | 'gallery', duration: number = 600) => {
    // Clear any existing timeout
    if (syncLockTimeoutRef.current) {
      clearTimeout(syncLockTimeoutRef.current);
    }
    
    syncSourceRef.current = source;
    console.log(`[SyncLock] 🔒 Acquired by ${source} for ${duration}ms`);
    
    // Auto-release lock after duration (increased for safety)
    syncLockTimeoutRef.current = setTimeout(() => {
      syncSourceRef.current = null;
      console.log(`[SyncLock] 🔓 Released (was ${source})`);
    }, duration);
  }, []);
  
  // Handle changes from editor (Editor → Gallery sync)
  const handleEditorChanges = useCallback((changes: { deleted: string[]; added: string[]; current: string[] }) => {
    console.log('[EditorSync] ====== EDITOR CHANGE DETECTED ======');
    console.log('[EditorSync] Current sync source:', syncSourceRef.current);
    console.log('[EditorSync] Changes received:', {
      deleted: changes.deleted,
      added: changes.added,
      currentCount: changes.current.length
    });
    
    // Skip if we're currently syncing from gallery
    if (syncSourceRef.current === 'gallery') {
      console.log('[EditorSync] ⚠️ Skipping - gallery sync in progress');
      return;
    }
    
    // Important: Process the changes even if no lock
    console.log('[EditorSync] ✅ Processing editor changes...');
    
    // Acquire lock for editor sync
    acquireSyncLock('editor');
    
    const currentImages = images;
    console.log('[EditorSync] Current gallery state:', currentImages.map(img => ({ id: img.id, name: img.name })));
    
    let newImages = [...currentImages];
    
    if (changes.deleted.length > 0) {
      console.log('[EditorSync] 🗑️ Processing deletions:', changes.deleted);
      
      const beforeCount = newImages.length;
      
      changes.deleted.forEach(deletedId => {
        const normalizedDeletedId = String(deletedId).trim();
        newImages = newImages.filter(img => String(img.id).trim() !== normalizedDeletedId);
      });
      
      const afterCount = newImages.length;
      console.log(`[EditorSync] Removed ${beforeCount - afterCount} images. Gallery now has ${afterCount} images.`);
    }
    
    // 부모의 상태를 직접 업데이트
    onImagesChange(newImages);
    
    // 썸네일이 삭제되었는지 확인
    if (changes.deleted.includes(selectedThumbnailId)) {
      console.log('[EditorSync] Clearing thumbnail selection');
      onThumbnailSelect('');
    }
  }, [acquireSyncLock, selectedThumbnailId, onImagesChange, onThumbnailSelect, images]); // `images` 의존성 추가
  
  // Setup editor monitoring
  const editorMonitor = useEditorImageMonitor({
    editor,
    onImagesChange: handleEditorChanges,
    isEnabled: true,
  });

  // Track if we need to rebuild editor due to reordering
  const [needsEditorRebuild, setNeedsEditorRebuild] = useState<UploadedImageInfo[] | null>(null);
  
  // Handle images change from ImageUploadManager (Gallery → Editor sync)
  const handleGalleryImageChange = useCallback((newImages: UploadedImageInfo[]) => {
    // Skip if we're currently syncing from editor
    if (syncSourceRef.current === 'editor') {
      console.log('[GallerySync] Skipping - editor sync in progress');
      return;
    }
    
    acquireSyncLock('gallery');
    
    const prevImages = images;

    // Check if image was deleted
    const deletedImages = prevImages.filter(
      prevImg => !newImages.find(img => img.id === prevImg.id)
    );
    
    if (deletedImages.length > 0) {
      console.log('[ImageManager] Detected deleted images:', deletedImages);
      deletedImages.forEach(deletedImg => {
        if (deletedImg.url && removeImageFromEditorRef.current) {
          removeImageFromEditorRef.current(deletedImg.url);
        }
      });
    }
    
    // Check for reordering
    if (prevImages.length === newImages.length && prevImages.length > 0) {
      const orderChanged = newImages.some((img, index) => prevImages[index]?.id !== img.id);
      if (orderChanged) {
        console.log('[ImageManager] Images reordered - scheduling rebuild');
        setNeedsEditorRebuild(newImages);
      }
    }
    
    // 부모 상태 업데이트
    onImagesChange(newImages);

  }, [onImagesChange, acquireSyncLock, editor, images]);
  
  // Handle newly uploaded images (insert to editor)
  const handleImagesUploaded = useCallback((newlyUploaded: UploadedImageInfo[]) => {
    if (editor && newlyUploaded.length > 0) {
      // 새로운 이미지를 기존 목록에 추가
      const updatedImages = [...images, ...newlyUploaded];
      onImagesChange(updatedImages);

      // Build a chain of commands to insert all images at once
      let chain = editor.chain().focus();
      
      newlyUploaded.forEach((image, index) => {
        if (!image.isUploading && image.url) {
          let imageUrl = image.url;
          if (!imageUrl.startsWith('http')) {
            imageUrl = `https://myblogdata84.s3.us-east-1.amazonaws.com/${image.url}`;
          }
          
          // Add spacing before image (except for the first one when no existing images)
          if (index > 0 || images.length > 0) {
            chain = chain.insertContent('<br/>');
          }
          
          console.log('[handleImagesUploaded] Inserting image with ID:', image.id);
          // Add the image
          chain = chain.setImage({
            src: imageUrl,
            alt: image.name,
            title: image.name,
            'data-image-id': image.id,
          });
          
          // Add spacing after each image (for separation)
          if (index < newlyUploaded.length - 1) {
            chain = chain.insertContent('<br/>');
          }
        }
      });
      
      // Execute all commands at once
      chain.run();
    }
  }, [editor, images, onImagesChange]);

  // Handle thumbnail selection
  const handleThumbnailSelect = useCallback((imageId: string) => {
    onThumbnailSelect(imageId);
  }, [onThumbnailSelect]);

  // Update editor reference when it changes
  useEffect(() => {
    // This effect ensures the hook re-renders when editor changes
    // The actual editor operations are handled in the callback functions
  }, [editor]);

  // Insert image into editor at current cursor position
  const insertImageIntoEditor = useCallback((image: UploadedImageInfo) => {
    if (!editor || image.isUploading) return;

    try {
      console.log('[insertImageIntoEditor] Inserting image with ID:', image.id);
      const attrs = {
        src: image.url,
        alt: image.name,
        title: image.name,
        'data-image-id': image.id,
      };
      console.log('[insertImageIntoEditor] Image attributes:', attrs);
      
      editor.chain().focus().setImage(attrs).run();

      // Track position in editor
      const currentPos = editor.state.selection.from;
      editorImagePositions.current.set(image.id, currentPos);
      
    } catch (error) {
      console.error('Failed to insert image into editor:', error);
    }
  }, [editor]);

  // Insert all images into editor in order
  const insertAllImagesIntoEditor = useCallback(() => {
    if (!editor) return;

    images
      .filter(img => !img.isUploading)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .forEach((image, index) => {
        if (index > 0) {
          // Add some spacing between images
          editor.chain().insertContent('<br/>').run();
        }
        insertImageIntoEditor(image);
      });
  }, [editor, images, insertImageIntoEditor]);

  // Rebuild all editor images in correct order
  const updateAllEditorImages = useCallback((imagesToBuild: UploadedImageInfo[]) => {
    console.log('[updateAllEditorImages] Called with', imagesToBuild.length, 'images');
    if (!editor) {
      console.warn('[updateAllEditorImages] Editor not available');
      return;
    }

    // Find all current image positions in the editor
    const imagePositions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') {
        imagePositions.push(pos);
      }
    });

    // Only proceed if there are images to remove OR images to add
    if (imagePositions.length > 0 || imagesToBuild.length > 0) {
      // Remove all images (in reverse order to maintain positions)
      if (imagePositions.length > 0) {
        const tr = editor.state.tr;
        imagePositions.reverse().forEach(pos => {
          const node = editor.state.doc.nodeAt(pos);
          if (node) {
            tr.delete(pos, pos + node.nodeSize);
          }
        });
        editor.view.dispatch(tr);
      }

      // Re-insert images in new order
      imagesToBuild.forEach((image, index) => {
        if (image.url && !image.isUploading) {
          const imageUrl = image.url.startsWith('http') 
            ? image.url 
            : `https://myblogdata84.s3.us-east-1.amazonaws.com/${image.url}`;
          
          if (index > 0) {
            editor.chain().insertContent('<br/>').run();
          }
          
          editor.chain().focus().setImage({
            src: imageUrl,
            alt: image.name,
            title: image.name,
            'data-image-id': image.id,
          }).run();
        }
      });
    }
  }, [editor]);

  // Handle when images are reordered
  const handleImageReorder = useCallback((reorderedImages: UploadedImageInfo[]) => {
    onImagesChange(reorderedImages);
    updateAllEditorImages(reorderedImages);
  }, [updateAllEditorImages, onImagesChange]);

  // Remove image from editor
  const removeImageFromEditor = useCallback((imageUrl: string) => {
    if (!editor) return false;
    
    let found = false;
    const { state } = editor;
    const { doc } = state;
    const positions: number[] = [];
    
    // Find all image nodes with matching URL
    doc.descendants((node, pos) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src;
        // Check if URL matches (handle both full URL and relative paths)
        if (src === imageUrl || 
            src.includes(imageUrl) || 
            imageUrl.includes(src) ||
            // Check if both URLs point to the same file ID
            (src.includes('/files/') && imageUrl.includes('/files/') && 
             src.split('/files/')[1]?.split('/')[0] === imageUrl.split('/files/')[1]?.split('/')[0])) {
          positions.push(pos);
          found = true;
        }
      }
    });
    
    // Remove images in reverse order to maintain positions
    if (positions.length > 0) {
      const tr = editor.state.tr;
      positions.reverse().forEach(pos => {
        const node = doc.nodeAt(pos);
        if (node) {
          tr.delete(pos, pos + node.nodeSize);
        }
      });
      editor.view.dispatch(tr);
      console.log('[removeImageFromEditor] Removed image:', imageUrl);
    }
    
    return found;
  }, [editor]);

  // Get thumbnail image info
  const getThumbnailImage = useCallback((): UploadedImageInfo | null => {
    if (!selectedThumbnailId) return null;
    return images.find(img => img.id === selectedThumbnailId) || null;
  }, [selectedThumbnailId, images]);

  // Set thumbnail by index (for auto-selection)
  const setThumbnailByIndex = useCallback((index: number) => {
    const image = images[index];
    if (image && !image.isUploading) {
      onThumbnailSelect(image.id);
    }
  }, [images, onThumbnailSelect]);

  // Clear all images
  const clearAllImages = useCallback(() => {
    // Remove from editor
    images.forEach(image => {
      if (image.url) {
        removeImageFromEditor(image.url);
      }
    });

    // Clear state by calling parent
    onImagesChange([]);
    onThumbnailSelect('');
    editorImagePositions.current.clear();
    
  }, [images, removeImageFromEditor, onImagesChange, onThumbnailSelect]);
  
  // Assign functions to refs for use in handleImagesChange
  useEffect(() => {
    removeImageFromEditorRef.current = removeImageFromEditor;
    updateAllEditorImagesRef.current = updateAllEditorImages;
  }, [removeImageFromEditor, updateAllEditorImages]);
  
  // Handle editor rebuild after reordering (outside of render cycle)
  useEffect(() => {
    if (needsEditorRebuild && updateAllEditorImagesRef.current) {
      if (syncSourceRef.current !== 'editor') {
        console.log('[ImageManager] Executing editor rebuild after render');
        updateAllEditorImagesRef.current(needsEditorRebuild);
      } else {
        console.log('[ImageManager] Skipping editor rebuild - editor sync in progress');
      }
      setNeedsEditorRebuild(null); // Clear the flag
    }
  }, [needsEditorRebuild]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncLockTimeoutRef.current) {
        clearTimeout(syncLockTimeoutRef.current);
      }
    };
  }, []);

  return {
    // No state returned, only handlers
    handleGalleryImageChange,
    handleImagesUploaded,
    handleThumbnailSelect,
    insertImageIntoEditor,
    insertAllImagesIntoEditor,
    removeImageFromEditor,
    updateAllEditorImages,
    getThumbnailImage,
    setThumbnailByIndex,
    clearAllImages,
    syncSource: syncSourceRef.current,
    isUploading: images.some(img => img.isUploading),
  };
}