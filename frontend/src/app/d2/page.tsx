import type { Metadata } from "next";
import CanvasSceneLab from "@/components/diagram-lab/CanvasSceneLab";

export const metadata: Metadata = {
  title: "Markdown Diagram Playground",
  description: "자동포스팅 시 Markdown 안에 diagram block을 어떻게 자연스럽게 넣고 렌더할지 확인하는 샘플 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default function D2Page() {
  return <CanvasSceneLab />;
}
