"use client";

import { useEffect, useId, useState } from "react";
import { renderD2Source } from "@/lib/diagram/render-d2";

interface D2RendererProps {
  source: string;
  className?: string;
  scale?: number;
}

export default function D2Renderer({
  source,
  className = "",
  scale = 1.15,
}: D2RendererProps) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const salt = useId().replace(/:/g, "_");

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      try {
        setIsLoading(true);
        setError(null);

        const rendered = await renderD2Source(source, {
          pad: 20,
          scale,
          salt,
        });

        if (!active) return;
        setSvg(rendered);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "D2 렌더링에 실패했습니다.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    renderDiagram();
    return () => {
      active = false;
    };
  }, [salt, scale, source]);

  if (isLoading) {
    return (
      <div className={`flex min-h-[260px] items-center justify-center text-sm text-[#6F8093] dark:text-[#93A5B7] ${className}`}>
        D2 렌더링 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`grid min-h-[260px] place-items-center px-4 text-center text-sm text-red-600 dark:text-red-300 ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div
      className={`min-h-[260px] overflow-auto [&_svg]:h-auto [&_svg]:w-max [&_svg]:min-w-full [&_svg]:max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
