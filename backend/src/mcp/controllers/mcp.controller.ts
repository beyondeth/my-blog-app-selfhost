import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import { McpApiKeyService } from "../services/mcp-api-key.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { Public } from "../../common/decorators/public.decorator";
import { CreateMcpApiKeyDto } from "../dto/create-mcp-api-key.dto";
import { ValidateMcpApiKeyDto } from "../dto/validate-mcp-api-key.dto";
import { UsageService } from "../../usage/usage.service";
import { ResourceType } from "../../common/enums/subscription.enum";

/**
 * MCP API Key 관리 컨트롤러
 *
 * 엔드포인트:
 * - POST /api/v1/mcp/keys: API Key 생성 (사용자당 1개)
 * - GET /api/v1/mcp/keys: 내 API Key 목록
 * - DELETE /api/v1/mcp/keys/:id: API Key 삭제
 * - POST /api/v1/mcp/validate-key: API Key 검증 (MCP Proxy → Backend)
 */
@Controller("mcp")
export class McpController {
  constructor(
    private readonly mcpApiKeyService: McpApiKeyService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * API Key 생성
   *
   * @param req JWT 인증된 요청 (user 정보 포함)
   * @param dto { blogId, name }
   * @returns { apiKey: 전체 키 (1회만 표시), keyHint, expiresAt }
   *
   * 정책:
   * - 사용자당 1개 제한 (기존 키 자동 삭제)
   * - 생성된 API Key는 1회만 표시됨 (재조회 불가)
   */
  @Post("keys")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createKey(@Request() req: any, @Body() dto: CreateMcpApiKeyDto) {
    const userId = req.user.id;

    const result = await this.mcpApiKeyService.create(
      userId,
      dto.blogId,
      dto.name,
    );

    return {
      message:
        "API Key created successfully. Save this key - it will not be shown again.",
      data: result,
    };
  }

  /**
   * 내 API Key 목록 조회
   *
   * @param req JWT 인증된 요청
   * @returns API Key 목록 (secret 제외, hint만 표시)
   */
  @Get("keys")
  @UseGuards(JwtAuthGuard)
  async listKeys(@Request() req: any) {
    const userId = req.user.id;

    const keys = await this.mcpApiKeyService.findByUser(userId);

    // Secret 제외하고 반환 (keyHint만 표시)
    const sanitizedKeys = keys.map((key) => ({
      id: key.id,
      keyHint: key.keyHint,
      name: key.name,
      blogId: key.blogId,
      blogName: key.blog.name,
      isActive: key.isActive,
      requestCount: key.requestCount,
      postsCreated: key.postsCreated,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));

    return {
      data: sanitizedKeys,
    };
  }

  /**
   * API Key 삭제
   *
   * @param req JWT 인증된 요청
   * @param id API Key ID
   */
  @Delete("keys/:id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKey(@Request() req: any, @Param("id") id: string) {
    const userId = req.user.id;

    await this.mcpApiKeyService.delete(id, userId);

    return;
  }

  /**
   * API Key 검증 (MCP Proxy Server → Backend)
   *
   * @param dto { apiKey }
   * @returns { userId, blogId, user, blog }
   *
   * 용도:
   * - MCP Proxy Server가 API Key를 검증하기 위해 호출
   * - VPC Internal Network에서만 접근 가능 (보안)
   *
   * 주의:
   * - 이 엔드포인트는 JWT 인증 없음 (API Key 자체가 인증)
   * - Rate Limiting 필요 (향후 추가)
   */
  @Post("validate-key")
  @Public()
  @HttpCode(HttpStatus.OK)
  async validateKey(@Body() dto: ValidateMcpApiKeyDto) {
    const mcpApiKey = await this.mcpApiKeyService.validateKey(dto.apiKey);

    return {
      valid: true,
      data: {
        keyId: mcpApiKey.id,
        userId: mcpApiKey.userId,
        blogId: mcpApiKey.blogId,
        user: {
          id: mcpApiKey.user.id,
          username: mcpApiKey.user.username,
          email: mcpApiKey.user.email,
        },
        blog: {
          id: mcpApiKey.blog.id,
          name: mcpApiKey.blog.name,
          slug: mcpApiKey.blog.alias || mcpApiKey.blog.slug, // Phase 2: alias 우선 표시
        },
      },
    };
  }

  /**
   * 포스트 생성 카운트 증가 (MCP Proxy → Backend)
   *
   * @param id API Key ID
   *
   * 용도:
   * - create_post 성공 시 MCP Proxy가 호출
   * - VPC Internal Network에서만 접근 가능
   */
  @Post("keys/:id/increment-posts")
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async incrementPosts(@Param("id") id: string) {
    await this.mcpApiKeyService.incrementPostsCreated(id);
    return;
  }

  // ============================================================
  // 관리자 전용 통계 API
  // ============================================================

  /**
   * 총 MCP 사용량 통계 (관리자 전용)
   *
   * @returns 전체 시스템의 MCP 사용량 통계
   */
  @Get("admin/stats/total")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getTotalStats() {
    const stats = await this.mcpApiKeyService.getTotalStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 월별 MCP 사용량 통계 (관리자 전용)
   *
   * @param year 연도 (예: 2025)
   * @param month 월 (1-12)
   * @returns 특정 월의 MCP 사용량 통계
   */
  @Get("admin/stats/monthly/:year/:month")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getMonthlyStats(
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    const stats = await this.mcpApiKeyService.getMonthlyStats(year, month);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 사용자별 MCP 통계 (관리자 전용)
   *
   * @param limit 조회할 사용자 수 (기본: 20)
   * @returns 사용량 순위별 사용자 통계
   */
  @Get("admin/stats/users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserStats(@Query("limit") limit?: number) {
    const stats = await this.mcpApiKeyService.getUserStats(limit || 20);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 시간별 MCP 사용량 (관리자 전용)
   *
   * @param hours 조회할 시간 범위 (기본: 24시간)
   * @returns 시간별 MCP 사용량
   */
  @Get("admin/stats/hourly")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getHourlyStats(@Query("hours") hours?: number) {
    const stats = await this.mcpApiKeyService.getHourlyStats(hours || 24);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 최근 MCP 활동 로그 (관리자 전용)
   *
   * @param limit 조회할 로그 수 (기본: 50)
   * @returns 최근 MCP 포스트 생성 이력
   */
  @Get("admin/logs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getRecentLogs(@Query("limit") limit?: number) {
    // 모든 사용자의 MCP_POST 사용 이력 조회
    const logs = await this.usageService.getUsageHistory(
      null, // 모든 사용자
      ResourceType.MCP_POST,
      null, // 시작 날짜
      null, // 종료 날짜
    );

    return {
      success: true,
      data: logs.slice(0, limit || 50),
    };
  }

  // ============================================================
  // Writing Styles API (프론트엔드용)
  // ============================================================

  /**
   * Writing Styles 목록 조회
   *
   * @returns 5가지 Writing Style 목록 (미리보기)
   *
   * 용도:
   * - /mcp 페이지에서 스타일 목록 표시
   * - 각 스타일의 메타데이터 + 짧은 설명
   */
  @Get("writing-styles")
  @Public()
  @HttpCode(HttpStatus.OK)
  async getWritingStyles() {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // writing-styles 디렉토리 경로
      // Docker 환경: /mcp-proxy-server/writing-styles
      // 로컬 개발: ./mcp-proxy-server/writing-styles
      const fs_sync = await import("fs");
      let styleDir = "/mcp-proxy-server/writing-styles";

      // 로컬 환경에서는 다른 경로 시도
      if (!fs_sync.existsSync(styleDir)) {
        styleDir = path.resolve(
          process.cwd(),
          "mcp-proxy-server/writing-styles",
        );
      }

      if (!fs_sync.existsSync(styleDir)) {
        styleDir = path.resolve(
          process.cwd(),
          "../mcp-proxy-server/writing-styles",
        );
      }

      const styles = [
        "default",
        "novel",
        "comedy",
        "podcast",
        "tutorial",
        "vibe",
        "research",
        "human",
      ];
      const styleData = [];

      for (const styleName of styles) {
        try {
          const filePath = path.join(styleDir, `${styleName}.md`);
          const content = await fs.readFile(filePath, "utf-8");

          // YAML Front Matter 파싱
          const match = content.match(/^---\n([\s\S]*?)\n---/);
          const metadata = this.parseYaml(match ? match[1] : "");

          // 짧은 미리보기 추출 (처음 500자)
          const preview = content
            .replace(/^---[\s\S]*?---/, "") // Front matter 제거
            .trim()
            .substring(0, 500);

          styleData.push({
            name: styleName,
            metadata,
            content: preview,
          });
        } catch (error) {
          console.warn(
            `[MCP] Failed to load style: ${styleName}. Returning fallback metadata.`,
          );
          // 스타일 로드 실패해도 계속 진행 (fallback)
          const styleMetadata: Record<string, any> = {
            default: {
              style_name: "Professional Technical Blog",
              language: "korean",
              min_length: 2000,
              target_length: "3000-5000",
              code_block_ratio: 0.2,
              ai_tag_required: true,
            },
            novel: {
              style_name: "Fiction Writer's Narrative Style",
              language: "korean",
              min_length: 2500,
              target_length: "4000-6000",
              code_block_ratio: 0.05,
              ai_tag_required: true,
            },
            comedy: {
              style_name: "Tech Comedy Blog Style",
              language: "korean",
              min_length: 2000,
              target_length: "3000-4500",
              code_block_ratio: 0.15,
              ai_tag_required: true,
            },
            podcast: {
              style_name: "Tech Podcast Script Style",
              language: "korean",
              min_length: 2500,
              target_length: "3500-5000",
              code_block_ratio: 0.05,
              ai_tag_required: true,
            },
            tutorial: {
              style_name: "Step-by-Step Tutorial Style",
              language: "korean",
              min_length: 3000,
              target_length: "4000-7000",
              code_block_ratio: 0.35,
              ai_tag_required: true,
            },
            vibe: {
              style_name: "Developer Learning Guide Style",
              language: "korean",
              min_length: 2500,
              target_length: "3500-5500",
              code_block_ratio: 0.15,
              ai_tag_required: true,
            },
            research: {
              style_name: "Research Insight Analysis Style",
              language: "korean",
              min_length: 6000,
              target_length: "6000-9000",
              code_block_ratio: 0.1,
              ai_tag_required: true,
            },
            human: {
              style_name: "Human-Like Writing Style",
              language: "korean",
              min_length: 5000,
              target_length: "5000-8000",
              code_block_ratio: 0.15,
              ai_tag_required: true,
            },
          };

          styleData.push({
            name: styleName,
            metadata: styleMetadata[styleName] || {
              style_name:
                styleName.charAt(0).toUpperCase() + styleName.slice(1),
              language: "korean",
              min_length: 2000,
              target_length: "3000-5000",
              code_block_ratio: 0.2,
              ai_tag_required: true,
            },
            content:
              '💡 전체 가이드를 보려면 "전체 가이드 보기" 버튼을 클릭하세요.',
          });
        }
      }

      return {
        success: true,
        data: styleData,
      };
    } catch (error) {
      console.error("Failed to fetch writing styles:", error);
      return {
        success: false,
        error: "Failed to fetch writing styles",
        data: [],
      };
    }
  }

  /**
   * 특정 Writing Style 전체 가이드 조회
   *
   * @param style 스타일 이름 (default, novel, comedy, podcast, tutorial)
   * @returns 전체 Writing Style 가이드 (Markdown)
   *
   * 용도:
   * - /mcp 페이지에서 "전체 가이드 보기" 클릭 시
   * - 스타일 가이드 다운로드 시
   */
  @Get("writing-styles/:style")
  @Public()
  @HttpCode(HttpStatus.OK)
  async getWritingStyleGuide(@Param("style") style: string) {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // 스타일 이름 검증
      const validStyles = [
        "default",
        "novel",
        "comedy",
        "podcast",
        "tutorial",
        "vibe",
        "research",
        "human",
      ];
      if (!validStyles.includes(style)) {
        return {
          success: false,
          error: `Invalid style: ${style}. Valid styles: ${validStyles.join(", ")}`,
          data: null,
        };
      }

      const fs_sync = await import("fs");
      let styleDir = "/mcp-proxy-server/writing-styles";

      // 로컬 환경에서는 다른 경로 시도
      if (!fs_sync.existsSync(styleDir)) {
        styleDir = path.resolve(
          process.cwd(),
          "mcp-proxy-server/writing-styles",
        );
      }

      if (!fs_sync.existsSync(styleDir)) {
        styleDir = path.resolve(
          process.cwd(),
          "../mcp-proxy-server/writing-styles",
        );
      }

      const filePath = path.join(styleDir, `${style}.md`);

      // 파일 존재 여부 확인
      try {
        await fs.access(filePath);
      } catch {
        return {
          success: false,
          error: `Style file not found: ${style}`,
          data: null,
        };
      }

      const content = await fs.readFile(filePath, "utf-8");

      // YAML Front Matter 파싱
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      const metadata = this.parseYaml(match ? match[1] : "");

      // Front Matter 제거한 본문만 반환
      const body = content.replace(/^---[\s\S]*?---\n?/, "");

      return {
        success: true,
        data: {
          name: style,
          metadata,
          fullContent: body,
        },
      };
    } catch (error) {
      console.error(`Failed to fetch writing style: ${style}`, error);
      return {
        success: false,
        error: "Failed to fetch writing style",
        data: null,
      };
    }
  }

  /**
   * 간단한 YAML Front Matter 파서
   * 실제로는 js-yaml 패키지 사용 권장
   */
  private parseYaml(yamlString: string): any {
    const result: any = {};

    const lines = yamlString.trim().split("\n");
    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        let value = valueParts.join(":").trim();

        // 큰따옴표 제거
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        // 작은따옴표 제거
        if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }

        // 타입 변환
        if (value === "true") {
          result[key.trim()] = true;
        } else if (value === "false") {
          result[key.trim()] = false;
        } else if (!isNaN(Number(value))) {
          result[key.trim()] = Number(value);
        } else {
          result[key.trim()] = value;
        }
      }
    }

    return result;
  }
}
