import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseEnumPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { ReportStatus, ReportType } from "./enums/report.enum";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Create a new report
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createReportDto: CreateReportDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    return await this.reportsService.create(
      createReportDto,
      req.user.id,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get all reports (admin/moderator only)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async findAll(
    @Query("status", new DefaultValuePipe(null)) status?: ReportStatus,
    @Query("type", new DefaultValuePipe(null)) type?: ReportType,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query(
      "limit",
      new DefaultValuePipe(parseInt(process.env.DEFAULT_PAGE_LIMIT || "20")),
      ParseIntPipe,
    )
    limit?: number,
  ) {
    return await this.reportsService.findAll(status, type, page, limit);
  }

  /**
   * Get report statistics (admin/moderator only)
   */
  @Get("statistics")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async getStatistics(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.reportsService.getStatistics(start, end);
  }

  /**
   * Get user's own reports
   */
  @Get("my-reports")
  async getMyReports(
    @Request() req,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query(
      "limit",
      new DefaultValuePipe(parseInt(process.env.DEFAULT_PAGE_LIMIT || "20")),
      ParseIntPipe,
    )
    limit?: number,
  ) {
    return await this.reportsService.findByUser(req.user.id, page, limit);
  }

  /**
   * Get a single report
   */
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string, @Request() req) {
    return await this.reportsService.findOne(id, req.user.id, req.user.role);
  }

  /**
   * Update report status (admin/moderator only)
   */
  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateReportDto: UpdateReportDto,
    @Request() req,
  ) {
    return await this.reportsService.update(id, updateReportDto, req.user.id);
  }

  /**
   * Batch update reports (admin/moderator only)
   */
  @Patch("batch/update")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async batchUpdate(
    @Body("reportIds") reportIds: string[],
    @Body("update") updateDto: UpdateReportDto,
    @Request() req,
  ) {
    return await this.reportsService.batchUpdate(
      reportIds,
      updateDto,
      req.user.id,
    );
  }
}
