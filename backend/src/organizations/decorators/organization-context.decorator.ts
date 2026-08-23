import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";

export const REQUIRE_ORGANIZATION_CONTEXT = "requireOrganizationContext";

export const RequireOrganizationContext = () =>
  SetMetadata(REQUIRE_ORGANIZATION_CONTEXT, true);

export const OrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    return request.organizationContext?.organizationId;
  },
);
