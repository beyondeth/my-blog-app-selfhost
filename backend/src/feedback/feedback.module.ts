import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { FeedbackTicket } from "./entities/feedback-ticket.entity";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackTicket]), EmailModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
