import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminPostsService, PostFilters } from "./admin-posts.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";

@ApiTags("admin-posts")
@ApiBearerAuth()
@Controller("admin/posts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminPostsController {
  constructor(private readonly adminPostsService: AdminPostsService) {}

  @Get()
  async getPosts(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("isPublished") isPublished?: string,
  ) {
    const filters: PostFilters = {};

    if (search) {
      filters.search = search;
    }
    if (category) {
      filters.category = category;
    }
    if (isPublished === "true") {
      filters.isPublished = true;
    } else if (isPublished === "false") {
      filters.isPublished = false;
    }

    const result = await this.adminPostsService.findAll(filters, page, limit);

    return {
      posts: result.data,
      total: result.total,
      totalPages: result.totalPages,
      page: result.page,
      limit: result.limit,
    };
  }
}
