import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: "내 Organization 목록 조회" })
  list(@Request() req: any) {
    return this.organizationsService.listForUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: "Organization 생성" })
  create(@Request() req: any, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(req.user.id, dto);
  }
}
