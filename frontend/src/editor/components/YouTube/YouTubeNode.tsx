"use client";

import React, { useMemo } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface YouTubeNodeProps extends NodeViewProps {
  selected: boolean;
}

const buildEmbedUrl = (src: string | null | undefined) => {
  if (!src) return "";
  const match = src.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  if (!match?.[1]) return "";
  return `https://www.youtube.com/embed/${match[1]}`;
};

export const YouTubeNode: React.FC<YouTubeNodeProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const isThumbnail = Boolean(node.attrs.isThumbnail);
  const embedUrl = useMemo(() => buildEmbedUrl(node.attrs.src), [node.attrs.src]);
  const width = node.attrs.width ?? 685;
  const height = node.attrs.height ?? 540;

  const handleThumbnailToggle = () => {
    const nextValue = !isThumbnail;
    updateAttributes({ isThumbnail: nextValue });
    toast.success(nextValue ? "썸네일로 설정되었습니다." : "썸네일이 해제되었습니다.");
  };

  return (
    <NodeViewWrapper
      className={cn(
        "relative my-6 mx-auto",
        selected && "ring-2 ring-emerald-400 rounded-lg",
      )}
      data-youtube-video
      data-thumbnail={isThumbnail ? "true" : undefined}
      contentEditable={false}
      draggable={true}
    >
      {selected && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleThumbnailToggle();
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              "bg-white/95 text-gray-800 border border-gray-200 shadow-lg backdrop-blur-sm",
              isThumbnail ? "bg-orange-400 text-gray-900" : "hover:bg-gray-100",
            )}
            title={isThumbnail ? "썸네일 해제" : "썸네일로 설정"}
          >
            {isThumbnail ? "⭐ 썸네일" : "☆ 썸네일"}
          </button>
        </div>
      )}

      <div
        className="relative mx-auto"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title="YouTube video"
            width="100%"
            height="100%"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full rounded-lg shadow-sm"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
            YouTube URL을 확인할 수 없습니다.
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
