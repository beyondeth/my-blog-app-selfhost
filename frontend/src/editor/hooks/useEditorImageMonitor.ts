import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';

interface EditorImageChange {
  deleted: string[];
  added: string[];
  current: string[];
}

interface UseEditorImageMonitorProps {
  editor: Editor | null;
  onImagesChange: (changes: EditorImageChange) => void;
  isEnabled?: boolean;
}

/**
 * Monitor editor for image changes (deletions, additions)
 * This enables bidirectional sync between editor and gallery
 */
export function useEditorImageMonitor({
  editor,
  onImagesChange,
  isEnabled = true,
}: UseEditorImageMonitorProps) {
  const previousImagesRef = useRef<Set<string>>(new Set());
  const syncLockRef = useRef<boolean>(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const hasInitializedRef = useRef<boolean>(false);

  /**
   * Extract all image and YouTube video IDs from the editor
   */
  const extractImageIds = useCallback((editor: Editor): Set<string> => {
    const imageIds = new Set<string>();
    
    editor.state.doc.descendants((node) => {
      // Handle regular images (mediumImage is our custom image extension)
      if (node.type.name === 'mediumImage') {
        // Try to get image ID from data attribute first
        const dataImageId = node.attrs['data-image-id'];
        // console.log('[EditorMonitor] 🔍 Checking mediumImage node, attrs:', node.attrs);
        if (dataImageId) {
          const normalizedId = String(dataImageId).trim();
          // console.log('[EditorMonitor] ✅ Found image with data-image-id:', normalizedId);
          imageIds.add(normalizedId);
        } else {
          // Fallback: extract from URL
          const src = node.attrs.src;
          // console.warn('[EditorMonitor] ⚠️ Image without data-image-id, trying URL extraction:', src);
          
          if (src) {
            // More aggressive ID extraction patterns
            const patterns = [
              /\/files\/([^\/]+)\/download/,  // /api/v1/files/{id}/download
              /\/files\/(\d+)/,  // /files/{numeric-id}
              /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,  // UUID anywhere
              /\/(\d+)$/,  // Numeric ID at end
              /id=([^&]+)/,  // Query param
              /\/([^\/]+)\.(jpg|jpeg|png|gif|webp)$/i,  // Filename without extension
            ];
            
            let foundId = null;
            for (const pattern of patterns) {
              const match = src.match(pattern);
              if (match && match[1]) {
                foundId = match[1];
                break;
              }
            }
            
            if (foundId) {
              const normalizedId = String(foundId).trim();
              // console.log('[EditorMonitor] 🔍 Extracted ID from URL:', normalizedId, 'from', src);
              imageIds.add(normalizedId);
            } else {
              // Last resort: use the entire URL as ID
              // console.error('[EditorMonitor] ❌ Could not extract ID, using URL as ID:', src);
              imageIds.add(src);
            }
          }
        }
      }
      
      // Handle YouTube videos - add them as yt_thumb_ IDs for gallery sync
      if (node.type.name === 'youtube') {
        const src = node.attrs.src;
        if (src) {
          // Extract video ID from YouTube URL
          const videoIdMatch = src.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
          if (videoIdMatch && videoIdMatch[1]) {
            const videoId = videoIdMatch[1];
            const youtubeThumbId = `yt_thumb_${videoId}`;
            // console.log('[EditorMonitor] 🎥 Found YouTube video, adding thumbnail ID:', youtubeThumbId);
            imageIds.add(youtubeThumbId);
          }
        }
      }
    });

    // console.log('[EditorMonitor] 📊 Total media in editor:', imageIds.size, Array.from(imageIds));
    return imageIds;
  }, []);

  // Store the onImagesChange in a ref to avoid dependency issues
  const onImagesChangeRef = useRef(onImagesChange);
  useEffect(() => {
    onImagesChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  /**
   * Check for changes in editor images - no dependencies to prevent recreation
   */
  const checkForChanges = useCallback(() => {
    if (!editor || !isEnabled) {
      return;
    }

    // Don't check if we're locked - but log it
    if (syncLockRef.current) {
      // console.log('[EditorMonitor] ⚠️ Sync lock active, skipping check');
      return;
    }

    const currentImages = extractImageIds(editor);
    const previousImages = previousImagesRef.current;
    
    // Detect deleted images
    const deleted = Array.from(previousImages).filter(
      id => !currentImages.has(id)
    );
    
    // Detect added images (direct paste, etc.)
    const added = Array.from(currentImages).filter(
      id => !previousImages.has(id)
    );
    
    // Only trigger if there are actual changes
    if (deleted.length > 0 || added.length > 0) {
      // console.log('[EditorMonitor] 🔍 Changes detected:', {
      //   deleted,
      //   added,
      //   current: Array.from(currentImages),
      //   previous: Array.from(previousImages),
      // });

      // Update reference BEFORE calling onImagesChange to prevent re-triggering
      previousImagesRef.current = currentImages;
      
      // Use ref to call the callback
      onImagesChangeRef.current({
        deleted,
        added,
        current: Array.from(currentImages),
      });
    } else {
      // Still update reference even if no changes
      previousImagesRef.current = currentImages;
    }
  }, [editor, isEnabled, extractImageIds]);

  /**
   * Debounced check function - stable reference
   */
  const scheduleCheck = useCallback(() => {
    // console.log('[EditorMonitor] 📅 Scheduling check...');

    // Clear any pending check
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Schedule new check with debounce
    checkTimeoutRef.current = setTimeout(() => {
      // console.log('[EditorMonitor] ⏰ Executing scheduled check');
      checkForChanges();
    }, 300); // Increased debounce for stability
  }, [checkForChanges]);

  /**
   * Lock sync temporarily to prevent infinite loops
   */
  const acquireSyncLock = useCallback((duration: number = 300) => {
    syncLockRef.current = true;
    // console.log('[EditorMonitor] Sync lock acquired');

    setTimeout(() => {
      syncLockRef.current = false;
      // console.log('[EditorMonitor] Sync lock released');
    }, duration);
  }, []);

  /**
   * Setup editor event listeners - with stable references
   */
  useEffect(() => {
    if (!editor || !isEnabled) return;

    // console.log('[EditorMonitor] Setting up listeners');

    const handleUpdate = () => {
      // console.log('[EditorMonitor] 📝 Editor update event fired');
      scheduleCheck();
    };

    const handleTransaction = ({ transaction }: any) => {
      // Check if document actually changed
      if (transaction.docChanged) {
        // console.log('[EditorMonitor] 📄 Transaction with doc change detected');

        // Check if the change involves images or YouTube videos
        let hasMediaChange = false;
        transaction.steps.forEach((step: any) => {
          const stepJSON = step.toJSON();
          const stepString = JSON.stringify(stepJSON);
          if (stepJSON && (stepString.includes('image') || stepString.includes('youtube'))) {
            hasMediaChange = true;
          }
        });

        if (hasMediaChange) {
          // console.log('[EditorMonitor] 🖼️ Media-related transaction detected (image or YouTube)!');
        }

        scheduleCheck();
      }
    };

    // Listen to editor updates
    editor.on('update', handleUpdate);
    editor.on('transaction', handleTransaction);

    // Do initial scan after a short delay to let everything settle
    const initialTimeout = setTimeout(() => {
      // console.log('[EditorMonitor] Initial scan');
      const currentImages = extractImageIds(editor);
      previousImagesRef.current = currentImages;
      // console.log('[EditorMonitor] Initial images:', Array.from(currentImages));
    }, 500);

    return () => {
      // console.log('[EditorMonitor] Cleaning up listeners');
      // Clean up
      editor.off('update', handleUpdate);
      editor.off('transaction', handleTransaction);
      clearTimeout(initialTimeout);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
    // Remove extractImageIds from dependencies to prevent re-runs
  }, [editor, isEnabled, scheduleCheck]);

  return {
    acquireSyncLock,
    checkForChanges,
    getCurrentImageIds: () => editor ? extractImageIds(editor) : new Set<string>(),
  };
}