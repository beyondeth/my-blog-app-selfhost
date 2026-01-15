import { Module } from "@nestjs/common";
import { ContentProcessingService } from "./services/content-processing.service";
import { HtmlSanitizerService } from "./services/html-sanitizer.service";
import { CodeHighlightService } from "./services/code-highlight.service";
import { ImageProcessorService } from "./services/image-processor.service";

/**
 * Content Processing 모듈
 *
 * 이 모듈은 콘텐츠 처리와 관련된 모든 서비스를 제공합니다:
 * - HTML 살균(Sanitization)
 * - 코드 하이라이팅
 * - 이미지 URL 정규화
 * - 콘텐츠 처리 파이프라인
 */
@Module({
  providers: [
    ContentProcessingService,
    HtmlSanitizerService,
    CodeHighlightService,
    ImageProcessorService,
  ],
  exports: [ContentProcessingService, HtmlSanitizerService],
})
export class ContentProcessingModule {}
