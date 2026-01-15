import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req: any,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.getNotifications(req.user.id, page, limit);
  }

  @Get("unread")
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Put(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    await this.notificationsService.markAsRead(id, req.user.id);
  }

  @Put("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    await this.notificationsService.delete(id, req.user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllNotifications(@Request() req: any) {
    await this.notificationsService.deleteAll(req.user.id);
  }
}
