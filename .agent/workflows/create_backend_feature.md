---
description: Create a new backend feature module with Controller, Service, DTO, and Entity.
---

# Create Backend Feature

Follow this workflow to add a new vertical slice to the NestJS backend.

## 1. Create Feature Structure
Use the NestJS CLI to scaffold the core files.

```bash
cd backend
# Replace 'feature-name' with your feature (e.g., 'notifications')
nest g module modules/feature-name
nest g controller modules/feature-name
nest g service modules/feature-name
```

## 2. Define Entity
Create the database schema definition.
*   **Path**: `src/modules/feature-name/entities/feature-name.entity.ts`
*   **Action**: Define class with `@Entity()`, `@Column()`, etc.
*   **Rule**: Always extend `CoreEntity` (id, created_at, updated_at) if available, or define standard audit fields.

## 3. Define DTOs (Data Transfer Objects)
**Strict Rule**: Never use raw objects or entities in Controller parameters.
*   **Create**: `create-feature-name.dto.ts`
*   **Update**: `update-feature-name.dto.ts`
*   **Validation**: Use `class-validator` decorators (`@IsString()`, `@IsOptional()`).

## 4. Implement Service Logic
*   Inject Repository: `constructor(@InjectRepository(FeatureEntity) private repo: Repository<FeatureEntity>)`
*   Implement CRUD methods.
*   **Rule**: Use `this.logger` for tracing. Throw `NotFoundException` or `BadRequestException` explicitly.

## 5. Implement Controller
*   Define Routes: `@Post()`, `@Get()`, etc.
*   Apply Guards: `@UseGuards(JwtAuthGuard)` if protected.
*   **Rule**: Controller methods should be one-liners calling the Service.

## 6. Update Module
Ensure `TypeOrmModule.forFeature([FeatureEntity])` is in the `imports` array of `FeatureNameModule`.

## 7. Verify
Run unit tests for the service.
```bash
npm test src/modules/feature-name
```
