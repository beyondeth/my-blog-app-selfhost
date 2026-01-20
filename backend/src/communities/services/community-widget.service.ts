import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import {
  Community,
  CommunitySidebarWidget,
  CommunitySidebarWidgetEntry,
} from "../entities";
import {
  CommunitySidebarWidgetEntryType,
  CommunitySidebarWidgetType,
} from "../enums";
import {
  CommunitySidebarWidgetDto,
  CommunitySidebarWidgetEntryDto,
} from "../interfaces/community-widget.interface";
import {
  CreateCommunityWidgetDto,
  CommunityWidgetItemInputDto,
  ReorderCommunityWidgetsDto,
  UpdateCommunityWidgetDto,
} from "../dto";

/**
 * 커뮤니티 사이드바 위젯 서비스
 */
@Injectable()
export class CommunityWidgetService {
  private readonly logger = new Logger(CommunityWidgetService.name);

  /**
   * 중복을 허용하지 않는 위젯 타입
   */
  private readonly singletonWidgetTypes: CommunitySidebarWidgetType[] = [
    CommunitySidebarWidgetType.BOOKMARKS,
    CommunitySidebarWidgetType.POST_FLAIRS,
    CommunitySidebarWidgetType.COMMUNITY_LIST,
    CommunitySidebarWidgetType.CALENDAR,
    CommunitySidebarWidgetType.COMMUNITY_RULES,
  ];

  constructor(
    @InjectRepository(CommunitySidebarWidget)
    private readonly widgetRepository: Repository<CommunitySidebarWidget>,
    @InjectRepository(CommunitySidebarWidgetEntry)
    private readonly entryRepository: Repository<CommunitySidebarWidgetEntry>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 커뮤니티 위젯 조회
   */
  async getWidgetsForCommunity(
    communityId: string,
    options?: { includeDisabled?: boolean },
  ): Promise<CommunitySidebarWidgetDto[]> {
    await this.ensureFoundationWidgets(communityId);

    const includeDisabled = options?.includeDisabled ?? false;

    const query = this.widgetRepository
      .createQueryBuilder("widget")
      .leftJoinAndSelect("widget.entries", "entry")
      .leftJoinAndSelect("entry.targetCommunity", "targetCommunity")
      .where("widget.communityId = :communityId", { communityId })
      .orderBy("widget.orderIndex", "ASC")
      .addOrderBy("entry.orderIndex", "ASC");

    if (!includeDisabled) {
      query.andWhere("widget.isEnabled = true");
    }

    const widgets = await query.getMany();
    return widgets.map((widget) => this.mapToDto(widget));
  }

  /**
   * 단일 위젯 조회
   */
  async getWidgetById(widgetId: string, communityId: string) {
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId, communityId },
      relations: ["entries", "entries.targetCommunity"],
      order: {
        entries: {
          orderIndex: "ASC",
        },
      },
    });

    if (!widget) {
      throw new NotFoundException("위젯을 찾을 수 없습니다");
    }

    return widget;
  }

  /**
   * 위젯 생성
   */
  async createWidget(
    communityId: string,
    dto: CreateCommunityWidgetDto,
  ): Promise<CommunitySidebarWidgetDto> {
    await this.ensureWidgetTypeAvailable(communityId, dto.type);

    const { metadata, entries } = await this.prepareWidgetData(
      communityId,
      dto.type,
      dto.metadata,
      dto.items ?? [],
    );

    const nextOrderIndex = await this.getNextOrderIndex(communityId);

    const result = await this.dataSource.transaction(async (manager) => {
      const widget = manager.create(CommunitySidebarWidget, {
        communityId,
        type: dto.type,
        title: dto.title?.trim() || null,
        description: dto.description?.trim() || null,
        isEnabled: dto.isEnabled ?? true,
        orderIndex: nextOrderIndex,
        metadata,
      });

      const savedWidget = await manager.save(widget);

      if (entries.length > 0) {
        const entryEntities = entries.map((entry, index) =>
          manager.create(CommunitySidebarWidgetEntry, {
            ...entry,
            widgetId: savedWidget.id,
            orderIndex: index + 1,
          }),
        );
        await manager.save(entryEntities);
      }

      return savedWidget;
    });

    const widgetWithRelations = await this.widgetRepository.findOne({
      where: { id: result.id },
      relations: ["entries", "entries.targetCommunity"],
      order: {
        entries: { orderIndex: "ASC" },
      },
    });

    return this.mapToDto(widgetWithRelations!);
  }

  /**
   * 위젯 수정
   */
  async updateWidget(
    communityId: string,
    widgetId: string,
    dto: UpdateCommunityWidgetDto,
  ): Promise<CommunitySidebarWidgetDto> {
    const widget = await this.getWidgetById(widgetId, communityId);

    const prepared = await this.prepareWidgetData(
      communityId,
      widget.type,
      dto.metadata ?? widget.metadata,
      dto.items ?? widget.entries.map((entry) => this.mapEntryToInput(entry)),
    );

    await this.dataSource.transaction(async (manager) => {
      if (dto.title !== undefined) {
        widget.title = dto.title?.trim() || null;
      }
      if (dto.description !== undefined) {
        widget.description = dto.description?.trim() || null;
      }
      if (dto.isEnabled !== undefined) {
        widget.isEnabled = dto.isEnabled;
      }

      widget.metadata = prepared.metadata;
      await manager.save(widget);

      if (dto.items) {
        await manager.delete(CommunitySidebarWidgetEntry, { widgetId });
        if (prepared.entries.length > 0) {
          const entryEntities = prepared.entries.map((entry, index) =>
            manager.create(CommunitySidebarWidgetEntry, {
              ...entry,
              widgetId,
              orderIndex: index + 1,
            }),
          );
          await manager.save(entryEntities);
        }
      }
    });

    const updated = await this.widgetRepository.findOne({
      where: { id: widgetId },
      relations: ["entries", "entries.targetCommunity"],
      order: { entries: { orderIndex: "ASC" } },
    });

    return this.mapToDto(updated!);
  }

  /**
   * 위젯 삭제
   */
  async deleteWidget(communityId: string, widgetId: string): Promise<void> {
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId, communityId },
      select: ["id", "type"],
    });

    if (!widget) {
      throw new NotFoundException("위젯을 찾을 수 없습니다");
    }

    if (
      widget.type === CommunitySidebarWidgetType.COMMUNITY_RULES
    ) {
      throw new BadRequestException("이 위젯은 비활성화만 가능합니다");
    }

    await this.widgetRepository.delete({ id: widgetId, communityId });
    await this.compactOrderIndex(communityId);
  }

  /**
   * 규칙/플레어 기본 위젯 자동 생성
   */
  private async ensureFoundationWidgets(communityId: string): Promise<void> {
    const foundationTypes: CommunitySidebarWidgetType[] = [
      CommunitySidebarWidgetType.COMMUNITY_RULES,
      CommunitySidebarWidgetType.POST_FLAIRS,
    ];

    const existing = await this.widgetRepository.find({
      where: {
        communityId,
        type: In(foundationTypes),
      },
      select: ["type"],
    });

    const existingTypes = new Set(existing.map((item) => item.type));

    let nextOrderIndex = await this.getNextOrderIndex(communityId);

    if (!existingTypes.has(CommunitySidebarWidgetType.COMMUNITY_RULES)) {
      await this.widgetRepository.save({
        communityId,
        type: CommunitySidebarWidgetType.COMMUNITY_RULES,
        title: "커뮤니티 규칙",
        description: null,
        isEnabled: true,
        orderIndex: nextOrderIndex++,
        metadata: {
          limit: 10,
          collapsed: false,
          showNumbering: true,
        },
      });
    }

    if (!existingTypes.has(CommunitySidebarWidgetType.POST_FLAIRS)) {
      const flairCount = await this.communityRepository
        .createQueryBuilder("community")
        .leftJoin("community.flairs", "flair")
        .where("community.id = :communityId", { communityId })
        .andWhere("flair.id IS NOT NULL")
        .getCount();

      await this.widgetRepository.save({
        communityId,
        type: CommunitySidebarWidgetType.POST_FLAIRS,
        title: "말머리",
        description: null,
        isEnabled: flairCount > 0,
        orderIndex: nextOrderIndex++,
        metadata: {
          showAll: true,
          showFilterButton: true,
          flairIds: [],
        },
      });
    }
  }

  /**
   * 위젯 순서 재정렬
   */
  async reorderWidgets(
    communityId: string,
    dto: ReorderCommunityWidgetsDto,
  ): Promise<void> {
    const widgetIds = dto.items.map((item) => item.id);
    if (widgetIds.length === 0) {
      throw new BadRequestException("재정렬할 위젯이 필요합니다");
    }

    const widgets = await this.widgetRepository.find({
      where: {
        id: In(widgetIds),
        communityId,
      },
      select: ["id"],
    });

    if (widgets.length !== widgetIds.length) {
      throw new BadRequestException("존재하지 않는 위젯이 포함되어 있습니다");
    }

    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < widgetIds.length; index++) {
        const widgetId = widgetIds[index];
        await manager.update(
          CommunitySidebarWidget,
          { id: widgetId, communityId },
          { orderIndex: index + 1 },
        );
      }
    });
  }

  /**
   * 위젯 단건 조회 (컨트롤러 편의)
   */
  async findWidgetOrFail(widgetId: string): Promise<CommunitySidebarWidget> {
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId },
    });

    if (!widget) {
      throw new NotFoundException("위젯을 찾을 수 없습니다");
    }

    return widget;
  }

  /**
   * DTO 변환
   */
  private mapToDto(widget: CommunitySidebarWidget): CommunitySidebarWidgetDto {
    return {
      id: widget.id,
      type: widget.type,
      title: widget.title || undefined,
      description: widget.description || undefined,
      orderIndex: widget.orderIndex,
      isEnabled: widget.isEnabled,
      metadata: widget.metadata || undefined,
      items: (widget.entries || []).map((entry) => this.mapEntry(entry)),
    };
  }

  private mapEntry(
    entry: CommunitySidebarWidgetEntry,
  ): CommunitySidebarWidgetEntryDto {
    return {
      id: entry.id,
      entryType: entry.entryType,
      label: entry.label || undefined,
      body: entry.body || undefined,
      linkUrl: entry.linkUrl || undefined,
      imageUrl: entry.imageUrl || undefined,
      imageAlt: entry.imageAlt || undefined,
      ctaLabel: entry.ctaLabel || undefined,
      ctaUrl: entry.ctaUrl || undefined,
      location: entry.location || undefined,
      startsAt: entry.startsAt?.toISOString(),
      endsAt: entry.endsAt?.toISOString(),
      metadata: entry.metadata || undefined,
      targetCommunity: entry.targetCommunity
        ? {
            id: entry.targetCommunity.id,
            slug: entry.targetCommunity.slug,
            name: entry.targetCommunity.name,
            iconUrl: entry.targetCommunity.iconUrl,
          }
        : entry.targetCommunityId
          ? { id: entry.targetCommunityId, slug: "", name: "" }
          : null,
      orderIndex: entry.orderIndex,
    };
  }

  private mapEntryToInput(
    entry: CommunitySidebarWidgetEntry,
  ): CommunityWidgetItemInputDto {
    return {
      label: entry.label || undefined,
      body: entry.body || undefined,
      linkUrl: entry.linkUrl || undefined,
      imageUrl: entry.imageUrl || undefined,
      imageAlt: entry.imageAlt || undefined,
      ctaLabel: entry.ctaLabel || undefined,
      ctaUrl: entry.ctaUrl || undefined,
      location: entry.location || undefined,
      startsAt: entry.startsAt?.toISOString(),
      endsAt: entry.endsAt?.toISOString(),
      targetCommunityId: entry.targetCommunityId || undefined,
      metadata: entry.metadata || undefined,
    };
  }

  /**
   * 위젯 타입 중복 검사
   */
  private async ensureWidgetTypeAvailable(
    communityId: string,
    type: CommunitySidebarWidgetType,
  ) {
    if (!this.singletonWidgetTypes.includes(type)) {
      return;
    }

    const existing = await this.widgetRepository.findOne({
      where: { communityId, type },
      select: ["id"],
    });

    if (existing) {
      throw new BadRequestException("해당 타입의 위젯은 이미 존재합니다");
    }
  }

  /**
   * orderIndex 압축
   */
  private async compactOrderIndex(communityId: string) {
    const widgets = await this.widgetRepository.find({
      where: { communityId },
      order: { orderIndex: "ASC" },
      select: ["id"],
    });

    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < widgets.length; index++) {
        const widget = widgets[index];
        await manager.update(
          CommunitySidebarWidget,
          { id: widget.id },
          { orderIndex: index + 1 },
        );
      }
    });
  }

  /**
   * orderIndex 계산
   */
  private async getNextOrderIndex(communityId: string): Promise<number> {
    const result = await this.widgetRepository
      .createQueryBuilder("widget")
      .where("widget.communityId = :communityId", { communityId })
      .select("COALESCE(MAX(widget.orderIndex), 0)", "max")
      .getRawOne<{ max: string }>();

    const max = Number(result?.max ?? 0);
    return max + 1;
  }

  /**
   * 위젯 데이터 준비 (검증 + 정규화)
   */
  private async prepareWidgetData(
    communityId: string,
    type: CommunitySidebarWidgetType,
    metadata: Record<string, any> | undefined,
    items: CommunityWidgetItemInputDto[],
  ): Promise<{
    metadata: Record<string, any>;
    entries: Array<Partial<CommunitySidebarWidgetEntry>>;
  }> {
    switch (type) {
      case CommunitySidebarWidgetType.TEXT:
        return this.prepareTextWidget(metadata);
      case CommunitySidebarWidgetType.BUTTONS:
        return this.prepareLinkWidget(type, items, { minItems: 1 });
      case CommunitySidebarWidgetType.BOOKMARKS:
        return this.prepareLinkWidget(type, items, { minItems: 1 });
      case CommunitySidebarWidgetType.IMAGES:
        return this.prepareImageWidget(items);
      case CommunitySidebarWidgetType.COMMUNITY_LIST:
        return this.prepareCommunityListWidget(items);
      case CommunitySidebarWidgetType.CALENDAR:
        return this.prepareCalendarWidget(items);
      case CommunitySidebarWidgetType.POST_FLAIRS:
        return this.preparePostFlairWidget(metadata);
      case CommunitySidebarWidgetType.COMMUNITY_RULES:
        return this.prepareRulesWidget(metadata);

      default:
        throw new BadRequestException("지원하지 않는 위젯 타입입니다");
    }
  }

  private prepareTextWidget(metadata?: Record<string, any>) {
    const content = metadata?.content;
    if (!content || typeof content !== "string" || !content.trim()) {
      throw new BadRequestException("텍스트 위젯 내용이 필요합니다");
    }

    const format = metadata?.format === "markdown" ? "markdown" : "plain";

    return {
      metadata: {
        content: content.trim().slice(0, 4000),
        format,
      },
      entries: [],
    };
  }

  private preparePostFlairWidget(metadata?: Record<string, any>) {
    const showAll = Boolean(metadata?.showAll);
    let normalized: string[] = [];

    if (!showAll) {
      const flairIds = metadata?.flairIds;
      if (!Array.isArray(flairIds) || flairIds.length === 0) {
        throw new BadRequestException("표시할 말머리를 최소 1개 이상 선택하세요");
      }
      if (flairIds.length > 20) {
        throw new BadRequestException(
          "말머리는 최대 20개까지 선택할 수 있습니다",
        );
      }

      normalized = flairIds
        .map((id: unknown) => (typeof id === "string" ? id : null))
        .filter((id): id is string => !!id);

      if (normalized.length === 0) {
        throw new BadRequestException("유효한 말머리 ID가 필요합니다");
      }
    }

    return {
      metadata: {
        flairIds: normalized,
        showAll,
        showFilterButton: metadata?.showFilterButton ?? true,
      },
      entries: [],
    };
  }

  private prepareRulesWidget(metadata?: Record<string, any>) {
    return {
      metadata: {
        limit:
          metadata?.limit && Number(metadata.limit) > 0
            ? Number(metadata.limit)
            : 10,
        collapsed: Boolean(metadata?.collapsed),
        showNumbering: metadata?.showNumbering !== false,
      },
      entries: [],
    };
  }


  private prepareLinkWidget(
    type: CommunitySidebarWidgetType,
    items: CommunityWidgetItemInputDto[],
    options?: { minItems?: number },
  ) {
    if (
      (options?.minItems ?? 0) > 0 &&
      items.length < (options?.minItems ?? 0)
    ) {
      throw new BadRequestException("항목을 최소 1개 이상 추가하세요");
    }

    const entries = items.map((item, index) => {
      if (!item.label?.trim()) {
        throw new BadRequestException("버튼 제목이 필요합니다");
      }
      if (!item.linkUrl) {
        throw new BadRequestException("버튼 링크가 필요합니다");
      }

      const entryType =
        type === CommunitySidebarWidgetType.BOOKMARKS
          ? CommunitySidebarWidgetEntryType.BOOKMARK
          : CommunitySidebarWidgetEntryType.LINK;

      return {
        entryType,
        label: item.label.trim().slice(0, 150),
        linkUrl: item.linkUrl,
        body: item.body?.trim() || null,
        ctaLabel: item.ctaLabel?.trim()?.slice(0, 120) || null,
        ctaUrl: item.ctaUrl || null,
        orderIndex: index + 1,
      };
    });

    return {
      metadata: {
        appearance: items.length > 3 ? "list" : "card",
      },
      entries,
    };
  }

  private prepareImageWidget(items: CommunityWidgetItemInputDto[]) {
    if (items.length === 0) {
      throw new BadRequestException(
        "이미지 위젯에는 최소 1개의 이미지가 필요합니다",
      );
    }

    const entries = items.map((item, index) => {
      if (!item.imageUrl) {
        throw new BadRequestException("이미지 URL이 필요합니다");
      }
      return {
        entryType: CommunitySidebarWidgetEntryType.IMAGE,
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt?.slice(0, 255) || null,
        linkUrl: item.linkUrl || null,
        label: item.label?.trim() || null,
        body: item.body?.trim() || null,
        metadata: item.metadata || null,
        orderIndex: index + 1,
      };
    });

    return {
      metadata: {
        layout: "stack",
        displayMode: "cover",
      },
      entries,
    };
  }

  private async prepareCommunityListWidget(
    items: CommunityWidgetItemInputDto[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException(
        "추천할 커뮤니티를 최소 1개 이상 선택하세요",
      );
    }

    const resolvedCommunities = [];
    for (const item of items) {
      const community = await this.resolveCommunityReference(item);
      if (!community) {
        throw new BadRequestException("추천 커뮤니티를 찾을 수 없습니다");
      }
      resolvedCommunities.push({
        entryType: CommunitySidebarWidgetEntryType.COMMUNITY,
        targetCommunityId: community.id,
        label: community.name,
        body: item.body?.trim() || null,
        metadata: {
          slug: community.slug,
          iconUrl: community.iconUrl,
        },
      });
    }

    const entries = resolvedCommunities.map((entry, index) => ({
      ...entry,
      orderIndex: index + 1,
    }));

    return {
      metadata: {
        layout: "list",
      },
      entries,
    };
  }

  private async resolveCommunityReference(
    item: CommunityWidgetItemInputDto,
  ): Promise<Pick<Community, "id" | "slug" | "name" | "iconUrl"> | null> {
    if (item.targetCommunityId) {
      const community = await this.communityRepository.findOne({
        where: { id: item.targetCommunityId },
        select: ["id", "slug", "name", "iconUrl"],
      });
      return community;
    }

    if (item.targetCommunitySlug) {
      const community = await this.communityRepository.findOne({
        where: { slug: item.targetCommunitySlug },
        select: ["id", "slug", "name", "iconUrl"],
      });
      return community;
    }

    return null;
  }

  private prepareCalendarWidget(items: CommunityWidgetItemInputDto[]) {
    if (items.length === 0) {
      throw new BadRequestException("캘린더 이벤트를 최소 1개 이상 추가하세요");
    }

    const entries = items.map((item, index) => {
      if (!item.label?.trim()) {
        throw new BadRequestException("이벤트 제목이 필요합니다");
      }
      if (!item.startsAt) {
        throw new BadRequestException("이벤트 시작 시간이 필요합니다");
      }

      const startsAt = new Date(item.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException("유효한 시작 시간을 입력하세요");
      }

      let endsAt: Date | null = null;
      if (item.endsAt) {
        endsAt = new Date(item.endsAt);
        if (Number.isNaN(endsAt.getTime())) {
          throw new BadRequestException("유효한 종료 시간을 입력하세요");
        }
      }

      return {
        entryType: CommunitySidebarWidgetEntryType.EVENT,
        label: item.label.trim().slice(0, 150),
        body: item.body?.trim() || null,
        startsAt,
        endsAt,
        location: item.location?.trim()?.slice(0, 250) || null,
        linkUrl: item.linkUrl || null,
        ctaLabel: item.ctaLabel?.trim()?.slice(0, 120) || null,
        ctaUrl: item.ctaUrl || null,
        orderIndex: index + 1,
      };
    });

    return {
      metadata: {
        timezone: "UTC",
      },
      entries,
    };
  }
}
