import { Controller, Post, Body, UseGuards, Req, Headers } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // 짧은 시간 피드백 도배 방지 (예: 보통 분당 2회 제한)
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post()
  @UseGuards(JwtAuthGuard)
  async submitFeedback(
    @CurrentUser() user: User,
    @Body() dto: SubmitFeedbackDto,
    @Headers("user-agent") userAgentHeader?: string,
  ) {
    if (!dto.userAgent && userAgentHeader) {
      dto.userAgent = userAgentHeader;
    }
    
    const result = await this.feedbackService.submitFeedback(user.id, dto);
    
    return {
      success: true,
      id: result.id,
      status: result.status,
      emailSent: result.emailSent,
    };
  }
}
