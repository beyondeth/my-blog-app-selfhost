import { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { UploadedImageInfo } from '../components/ImageManager/ImageUploadManager';
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
  const removeYouTubeFromEditorRef = useRef<(videoId: string) => boolean>();
  const updateAllEditorImagesRef = useRef<(images: UploadedImageInfo[]) => void>();
  
  // Sync lock to prevent infinite loops between editor and gallery
  const syncSourceRef = useRef<'editor' | 'gallery' | null>(null);
  const [syncSource, setSyncSource] = useState<'editor' | 'gallery' | null>(null);
  const syncLockTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Helper function to acquire sync lock
  const acquireSyncLock = useCallback((source: 'editor' | 'gallery', duration: number = 1000) => {
    // Clear any existing timeout
    if (syncLockTimeoutRef.current) {
      clearTimeout(syncLockTimeoutRef.current);
    }
    
    syncSourceRef.current = source;
    setSyncSource(source);
    console.log(`[SyncLock] 🔒 Acquired by ${source} for ${duration}ms`);
    
    // Auto-release lock after duration (increased for reorder operations)
    syncLockTimeoutRef.current = setTimeout(() => {
      syncSourceRef.current = null;
      setSyncSource(null);
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
        console.log('[EditorSync] Checking deletion of:', normalizedDeletedId);
        
        // Check if it's a YouTube thumbnail being deleted
        if (normalizedDeletedId.startsWith('yt_thumb_')) {
          console.log('[EditorSync] 🎥 YouTube thumbnail deletion detected:', normalizedDeletedId);
          // Dispatch event to clear processedVideoIds
          const videoId = normalizedDeletedId.replace('yt_thumb_', '');
          const event = new CustomEvent('youtubeDeletedFromEditor', {
            detail: { videoId }
          });
          window.dispatchEvent(event);
          console.log('[EditorSync] 📢 Dispatched youtubeDeletedFromEditor event for:', videoId);
        }
        
        // Filter out the deleted item from gallery
        const beforeFilterCount = newImages.length;
        newImages = newImages.filter(img => {
          const imgId = String(img.id).trim();
          const shouldKeep = imgId !== normalizedDeletedId;
          if (!shouldKeep) {
            console.log('[EditorSync] Removing from gallery:', imgId);
          }
          return shouldKeep;
        });
        const afterFilterCount = newImages.length;
        
        if (beforeFilterCount === afterFilterCount) {
          console.warn('[EditorSync] ⚠️ No item removed for ID:', normalizedDeletedId);
        }
      });
      
      const afterCount = newImages.length;
      console.log(`[EditorSync] Removed ${beforeCount - afterCount} items. Gallery now has ${afterCount} items.`);
    }
    
    // 부모의 상태를 직접 업데이트
    console.log('[EditorSync] Updating gallery with new state:', newImages.map(img => ({ id: img.id, name: img.name })));
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

  // REMOVED: needsEditorRebuild state that was causing issues
  // Gallery order changes should not trigger editor rebuilds
  
  // Handle images change from ImageUploadManager (Gallery → Editor sync)
  const handleGalleryImageChange = useCallback((newImages: UploadedImageInfo[]) => {
    console.log('[GallerySync] 🔄 handleGalleryImageChange called with', newImages.length, 'images');
    
    // Skip if we're currently syncing from editor or gallery (reorder)
    if (syncSourceRef.current) {
      console.log('[GallerySync] ⚠️ Skipping - sync in progress by:', syncSourceRef.current);
      return;
    }
    
    acquireSyncLock('gallery', 500);  // 짧은 lock - 삭제만 처리
    
    const prevImages = images;

    // Check if image was deleted
    const deletedImages = prevImages.filter(
      prevImg => !newImages.find(img => img.id === prevImg.id)
    );
    
    if (deletedImages.length > 0) {
      console.log('[ImageManager] Detected deleted images:', deletedImages);
      deletedImages.forEach(deletedImg => {
        // Check if it's a YouTube thumbnail
        if (deletedImg.id.startsWith('yt_thumb_')) {
          // Extract video ID and remove YouTube iframe from editor
          const videoId = deletedImg.id.replace('yt_thumb_', '');
          console.log('[ImageManager] Removing YouTube video from editor:', videoId);
          if (removeYouTubeFromEditorRef.current) {
            removeYouTubeFromEditorRef.current(videoId);
          }
        } else if (deletedImg.url && removeImageFromEditorRef.current) {
          // Regular image removal
          removeImageFromEditorRef.current(deletedImg.url);
        }
      });
    }
    
    // REMOVED: Reordering logic that was causing YouTube to disappear
    // Gallery order and editor order should be independent
    // Gallery is for display/selection, editor is for actual content
    
    // 부모 상태 업데이트
    onImagesChange(newImages);
    
    // Auto-select first image as thumbnail
    // 1. 선택된 썸네일이 없거나
    // 2. 선택된 썸네일이 삭제되었거나
    // 3. 새 이미지가 추가되어 첫 번째가 바뀌었을 때
    if (newImages.length > 0) {
      const currentSelectionValid = selectedThumbnailId && 
        newImages.some(img => img.id === selectedThumbnailId);
      
      if (!currentSelectionValid) {
        // 현재 선택이 유효하지 않으면 첫 번째 이미지 선택
        onThumbnailSelect(newImages[0].id);
      }
    }
    
    // Release lock after short delay
    setTimeout(() => {
      if (syncSourceRef.current === 'gallery') {
        syncSourceRef.current = null;
        setSyncSource(null);
        console.log('[GallerySync] Released sync lock');
      }
    }, 300);

  }, [onImagesChange, acquireSyncLock, editor, images]);
  
  // Handle newly uploaded images (insert to editor)
  const handleImagesUploaded = useCallback((newlyUploaded: UploadedImageInfo[]) => {
    console.log('[handleImagesUploaded] 🚨 호출됨 - 새 이미지:', newlyUploaded.length, '개');
    console.log('[handleImagesUploaded] 🚨 Editor 상태:', !!editor, editor?.isDestroyed);
    console.log('[handleImagesUploaded] 🚨 받은 이미지들:', newlyUploaded);
    
    if (!editor) {
      console.error('[handleImagesUploaded] ❌ Editor가 없습니다!');
      return;
    }
    
    if (newlyUploaded.length > 0) {
      // 새로운 이미지를 기존 목록에 추가
      const updatedImages = [...images, ...newlyUploaded];
      onImagesChange(updatedImages);

      // Filter out YouTube thumbnails - they're already in the editor as iframes
      const actualImages = newlyUploaded.filter(img => !img.id.startsWith('yt_thumb_'));
      console.log('[handleImagesUploaded] 🎯 실제 이미지:', actualImages.length, '개');
      
      if (actualImages.length > 0) {
        // 즉시 포커스 설정하고 이미지 삽입
        console.log('[handleImagesUploaded] 🔥 포커스 설정 및 이미지 삽입 시작');
        
        // 포커스가 없으면 먼저 포커스 설정
        if (!editor.isFocused) {
          console.log('[handleImagesUploaded] 📍 포커스 없음 - 설정 중...');
          editor.chain().focus('end').run();
        }
        
        // 약간의 지연 후 이미지 삽입
        setTimeout(() => {
          if (!editor || editor.isDestroyed) {
            console.error('[handleImagesUploaded] ❌ Editor가 사라졌습니다!');
            return;
          }
          
          console.log('[handleImagesUploaded] 🎨 이미지 삽입 시작');
          
          // Build a chain of commands to insert all actual images at once
          const chain = editor.chain();
          
          // Ensure focus
          chain.focus();
          
          actualImages.forEach((image, index) => {
            if (!image.isUploading && image.url) {
              let imageUrl = image.url;
              if (!imageUrl.startsWith('http')) {
                imageUrl = `https://myblogdata84.s3.us-east-1.amazonaws.com/${image.url}`;
              }
              
              // Add spacing between images
              if (index > 0) {
                chain.insertContent(' ');
              }
              
              console.log('[handleImagesUploaded] Adding image to chain:', image.id, imageUrl);
              // Add the image with proper attributes
              const imageAttrs: any = {
                src: imageUrl,
                alt: image.name || 'Uploaded image',
                title: image.name || 'Uploaded image',
              };
              // Add data-image-id as a separate property
              imageAttrs['data-image-id'] = image.id;
              
              chain.setImage(imageAttrs);
            }
          });
          
          // Execute all commands at once
          console.log('[handleImagesUploaded] 🚀 Executing chain with', actualImages.length, 'images');
          chain.run();
          
          console.log('[handleImagesUploaded] ✅ 이미지 삽입 완료!');
        }, 100); // 100ms delay to ensure editor is ready
      }
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
    
    // Skip YouTube thumbnails - they're already in the editor as iframes
    if (image.id.startsWith('yt_thumb_')) {
      console.log('[insertImageIntoEditor] Skipping YouTube thumbnail:', image.id);
      return;
    }

    try {
      console.log('[insertImageIntoEditor] Inserting image with ID:', image.id);
      const attrs: any = {
        src: image.url,
        alt: image.name,
        title: image.name,
      };
      // Set data-image-id separately to ensure it's properly added
      attrs['data-image-id'] = image.id;
      console.log('[insertImageIntoEditor] 🎨 Setting image with attributes:', attrs);
      
      editor.chain().focus().setImage(attrs).run();
      
      // Verify it was set correctly
      setTimeout(() => {
        let foundId = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'resizableImage' && node.attrs.src === image.url) {
            console.log('[insertImageIntoEditor] 🔍 Verification - Image node attrs after insert:', node.attrs);
            if (node.attrs['data-image-id']) {
              console.log('[insertImageIntoEditor] ✅ data-image-id was successfully set:', node.attrs['data-image-id']);
              foundId = true;
            } else {
              console.error('[insertImageIntoEditor] ❌ data-image-id was NOT set!');
            }
          }
        });
        if (!foundId && image.url) {
          console.warn('[insertImageIntoEditor] ⚠️ Could not find image with URL:', image.url);
        }
      }, 100);

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

    // Filter out YouTube thumbnails - they're already in the editor as iframes
    const actualImages = images
      .filter(img => !img.isUploading && !img.id.startsWith('yt_thumb_'))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    
    actualImages.forEach((image, index) => {
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

    // Filter out YouTube thumbnails - they exist as iframes in the editor, not images
    const actualImages = imagesToBuild.filter(img => !img.id.startsWith('yt_thumb_'));
    console.log('[updateAllEditorImages] Filtered to', actualImages.length, 'actual images (excluding YouTube thumbnails)');

    // Find all current image positions in the editor (not iframes)
    const imagePositions: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'resizableImage') {
        imagePositions.push(pos);
      }
    });

    // Only proceed if there are images to remove OR images to add
    if (imagePositions.length > 0 || actualImages.length > 0) {
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

      // Re-insert only actual images in new order (skip YouTube thumbnails)
      actualImages.forEach((image, index) => {
        if (image.url && !image.isUploading) {
          const imageUrl = image.url.startsWith('http') 
            ? image.url 
            : `https://myblogdata84.s3.us-east-1.amazonaws.com/${image.url}`;
          
          if (index > 0) {
            editor.chain().insertContent('<br/>').run();
          }
          
          const imgAttrs: any = {
            src: imageUrl,
            alt: image.name,
            title: image.name,
          };
          imgAttrs['data-image-id'] = image.id;
          editor.chain().focus().setImage(imgAttrs).run();
        }
      });
    }
  }, [editor]);

  // Update all media (images and YouTube) in editor to match gallery order
  // COMPLETELY REDESIGNED: Safe approach using content replacement
  const updateAllEditorMedia = useCallback((mediaItems: UploadedImageInfo[]) => {
    console.log('[updateAllEditorMedia] 🎨 Starting reorder with', mediaItems.length, 'items');
    
    if (!editor || editor.isDestroyed) {
      console.warn('[updateAllEditorMedia] ❌ Editor not available');
      return;
    }

    try {
      // Collect existing media nodes with their attributes
      const existingMedia: Map<string, any> = new Map();
      
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'resizableImage') {
          const imageId = node.attrs['data-image-id'];
          if (imageId) {
            existingMedia.set(imageId, {
              type: 'resizableImage',
              attrs: { ...node.attrs }
            });
          }
        } else if (node.type.name === 'youtube') {
          const src = node.attrs.src || '';
          const videoIdMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
          if (videoIdMatch) {
            const thumbId = `yt_thumb_${videoIdMatch[1]}`;
            existingMedia.set(thumbId, {
              type: 'youtube',
              attrs: { ...node.attrs }
            });
          }
        }
      });

      console.log('[updateAllEditorMedia] Found', existingMedia.size, 'existing media items');
      
      // Check if order actually changed
      const currentOrder = Array.from(existingMedia.keys());
      const newOrder = mediaItems.map(item => item.id);
      
      if (JSON.stringify(currentOrder) === JSON.stringify(newOrder)) {
        console.log('[updateAllEditorMedia] ✅ Order already correct');
        return;
      }

      console.log('[updateAllEditorMedia] Order changing from:', currentOrder, 'to:', newOrder);

      // Build new content array
      const newContent: any[] = [];
      
      mediaItems.forEach((item, index) => {
        // Add spacing paragraph between items
        if (index > 0) {
          newContent.push({
            type: 'paragraph',
            content: []
          });
        }
        
        const existingNode = existingMedia.get(item.id);
        
        if (item.id.startsWith('yt_thumb_')) {
          // YouTube video
          if (existingNode && existingNode.type === 'youtube') {
            const videoId = item.id.replace('yt_thumb_', '');
            let originalUrl = existingNode.attrs.originalUrl || existingNode.attrs.src;
            
            if (!originalUrl || originalUrl.includes('/embed/')) {
              originalUrl = `https://www.youtube.com/watch?v=${videoId}`;
            }
            
            newContent.push({
              type: 'youtube',
              attrs: {
                ...existingNode.attrs,
                src: originalUrl,
                originalUrl: originalUrl
              }
            });
            console.log(`[updateAllEditorMedia] Added YouTube: ${item.id}`);
          }
        } else if (item.url && existingNode) {
          // Regular image
          newContent.push({
            type: 'resizableImage',
            attrs: existingNode.attrs
          });
          console.log(`[updateAllEditorMedia] Added image: ${item.id}`);
        }
      });
      
      // Add final paragraph
      newContent.push({
        type: 'paragraph',
        content: []
      });

      console.log('[updateAllEditorMedia] 📝 Building new document with', newContent.length, 'nodes');
      
      // Create new document content
      const newDoc = {
        type: 'doc',
        content: newContent
      };
      
      // Replace entire document content in one transaction
      const tr = editor.state.tr;
      const docNode = editor.schema.nodeFromJSON(newDoc);
      
      // Replace the entire document content
      tr.replaceWith(0, editor.state.doc.content.size, docNode.content);
      
      // Apply transaction
      editor.view.dispatch(tr);
      
      // Focus at end
      editor.commands.focus('end');
      
      console.log('[updateAllEditorMedia] ✅ Media reorder complete');
    } catch (error) {
      console.error('[updateAllEditorMedia] Error:', error);
    }
  }, [editor]);

  // Handle when images are reordered
  const handleImageReorder = useCallback((reorderedImages: UploadedImageInfo[]) => {
    console.log('[handleImageReorder] 🔄 Reordering images:', reorderedImages.length);
    console.log('[handleImageReorder] Reordered list:', reorderedImages.map(img => ({ id: img.id, name: img.name })));
    
    // Check if sync is already in progress
    if (syncSourceRef.current) {
      console.log('[handleImageReorder] ⚠️ Sync already in progress by:', syncSourceRef.current);
      return;
    }
    
    if (!editor || editor.isDestroyed) {
      console.warn('[handleImageReorder] ❌ Editor not available');
      // 에디터가 없어도 갤러리 상태는 업데이트해야 함
      onImagesChange(reorderedImages);
      return;
    }
    
    // Acquire sync lock for gallery operation with longer duration for reorder
    acquireSyncLock('gallery', 3000);
    
    // Update positions in the reordered images
    reorderedImages.forEach((img, index) => {
      img.position = index;
    });
    
    // 갤러리 상태 업데이트 (중요!)
    onImagesChange(reorderedImages);
    
    // Use updateAllEditorMedia to handle both images and YouTube videos
    console.log('[handleImageReorder] 🎨 Calling updateAllEditorMedia with reordered items');
    updateAllEditorMedia(reorderedImages);
    
    // Release lock after operation completes
    setTimeout(() => {
      if (syncSourceRef.current === 'gallery') {
        syncSourceRef.current = null;
        setSyncSource(null);
        console.log('[handleImageReorder] 🔓 Released gallery sync lock after reorder');
      }
    }, 1000);
  }, [editor, acquireSyncLock, updateAllEditorMedia, onImagesChange]);

  // Remove image from editor
  const removeImageFromEditor = useCallback((imageUrl: string) => {
    if (!editor) return false;
    
    let found = false;
    const { state } = editor;
    const { doc } = state;
    const positions: number[] = [];
    
    // Find all image nodes with matching URL
    doc.descendants((node, pos) => {
      if (node.type.name === 'resizableImage') {
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

  // Remove YouTube video from editor
  const removeYouTubeFromEditor = useCallback((videoId: string) => {
    if (!editor) return false;
    
    let found = false;
    const { state } = editor;
    const { doc } = state;
    const positions: number[] = [];
    
    // Find all YouTube nodes with matching video ID
    doc.descendants((node, pos) => {
      if (node.type.name === 'youtube') {
        const src = node.attrs.src;
        // Check if this YouTube node contains the video ID
        if (src && src.includes(videoId)) {
          positions.push(pos);
          found = true;
          console.log('[removeYouTubeFromEditor] Found YouTube video to remove:', videoId, 'at position:', pos);
        }
      }
    });
    
    // Remove YouTube nodes in reverse order to maintain positions
    if (positions.length > 0) {
      const tr = editor.state.tr;
      positions.reverse().forEach(pos => {
        const node = doc.nodeAt(pos);
        if (node) {
          tr.delete(pos, pos + node.nodeSize);
        }
      });
      editor.view.dispatch(tr);
      console.log('[removeYouTubeFromEditor] Removed YouTube video:', videoId);
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
    removeYouTubeFromEditorRef.current = removeYouTubeFromEditor;
    updateAllEditorImagesRef.current = updateAllEditorImages;
  }, [removeImageFromEditor, removeYouTubeFromEditor, updateAllEditorImages]);
  
  // DISABLED: Editor rebuild after reordering
  // This was causing YouTube videos to disappear when gallery order changed
  // Gallery order and editor order should be independent
  /*
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
  */
  
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
    handleImageReorder,
    insertImageIntoEditor,
    insertAllImagesIntoEditor,
    removeImageFromEditor,
    updateAllEditorImages,
    getThumbnailImage,
    setThumbnailByIndex,
    clearAllImages,
    syncSource: syncSource,
    isUploading: images.some(img => img.isUploading),
  };
}