/**
 * 평판 시스템 - Editor's Pick 이벤트 리스너
 *
 * Editor's Pick 선정 이벤트를 구독하여 작성자에게 평판 점수를 부여합니다.
 * - 포스트당 1회만 부여 (LedgerService에서 중복 차단)
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheInvalidationEvents, EditorPickToggledEvent } from '../../common/events/cache.events';
import { Post } from '../../posts/entities/post.entity';
import { ReputationAction, REPUTATION_ACTION_SCORES } from '../enums/reputation-action.enum';
import { LedgerService } from '../services/ledger.service';
import { AggregatorService } from '../services/aggregator.service';
import { LeaderboardService } from '../services/leaderboard.service';

@Injectable()
export class EditorPickEventsListener {
  private readonly logger = new Logger(EditorPickEventsListener.name);

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly aggregatorService: AggregatorService,
    private readonly leaderboardService: LeaderboardService,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  @OnEvent(CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED)
  async handleEditorPickToggled(payload: EditorPickToggledEvent): Promise<void> {
    if (!payload.isPicked) {
      return;
    }

    try {
      const post = await this.postRepository.findOne({
        where: { id: payload.postId },
        select: ['id', 'authorId', 'isDeleted'],
      });

      if (!post) {
        this.logger.warn(`포스트를 찾을 수 없음: postId=${payload.postId}`);
        return;
      }

      if (post.isDeleted) {
        this.logger.warn(`삭제된 포스트는 점수 부여하지 않음: postId=${payload.postId}`);
        return;
      }

      const recorded = await this.ledgerService.record({
        userId: post.authorId,
        actionType: ReputationAction.EDITOR_PICKED,
        targetType: 'post',
        targetId: post.id,
        delta: REPUTATION_ACTION_SCORES[ReputationAction.EDITOR_PICKED],
        metadata: {
          editorPicked: true,
        },
      });

      if (!recorded) {
        return;
      }

      const totals = await this.aggregatorService.aggregateUser(post.authorId);
      await this.leaderboardService.updateUserScores(
        post.authorId,
        totals.map((total) => ({
          period: total.period,
          decayedScore: total.decayedScore,
        })),
      );

      this.logger.log(
        `EDITOR_PICKED 즉시 반영: authorId=${post.authorId}, postId=${post.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Editor’s Pick 평판 큐 추가 실패: ${error.message}`,
        error.stack,
      );
    }
  }
}
