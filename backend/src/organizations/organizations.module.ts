import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization } from "./entities/organization.entity";
import { OrganizationMember } from "./entities/organization-member.entity";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationContextGuard } from "./guards/organization-context.guard";
import { CommonModule } from "../common/common.module";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationMember]),
    CommonModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationContextGuard],
  exports: [OrganizationsService, OrganizationContextGuard],
})
export class OrganizationsModule {}
