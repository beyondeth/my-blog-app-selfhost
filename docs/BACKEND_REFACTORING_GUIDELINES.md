# Backend Refactoring Guidelines (NestJS)

## Overview
This document outlines a practical refactoring strategy for the current NestJS backend. The goal is to improve maintainability, readability, and testability by addressing "Fat Services" and tight coupling, **without** migrating to a full DDD or Clean Architecture. We will keep the existing DB/API contracts and NestJS DI system intact.

## Core Issues Identified
1. **Fat Services:** `users.service.ts` (1557 lines), `posts.service.ts` (1243 lines), `auth.service.ts` (1158 lines), `comments.service.ts` (1057 lines).
2. **Hidden Side Effects:** Business logic is tightly coupled with cache invalidation, event emission, permission checks, and statistics updates.
3. **Module Coupling:** Presence of `forwardRef` (11 instances) and numerous cross-module service imports indicating circular dependencies and tight coupling.
4. **Naming Consistency:** Lack of Ubiquitous Language. Variables and DTOs sometimes use generic names (e.g., `targetUserId`) instead of domain-specific ones (e.g., `memberIdToBan`).

## Refactoring Strategy & Principles

### 1. Folder Structure & Service Splitting (CQS Pattern)
Instead of one massive service per domain, split services based on Command Query Separation (CQS) or specific feature sets. Massive facade services (e.g. `PostsService`) should be retained only as a Facade that delegates to sub-services, or totally removed.

**Before:**
```typescript
// src/domain/domain.service.ts (Handles creation, deletion, fetching, caching, reporting...)
```

**After (Standardized Team Template):**
```text
src/domain/
├── controllers/          # HTTP Endpoint routing only
├── dto/                  # Request/Response validation
├── entities/             # TypeORM Entities (Unchanged)
├── services/
│   ├── domain-query.service.ts   # Read operations (find, search, list)
│   ├── domain-command.service.ts # Write operations (create, update, delete)
│   ├── domain-event.service.ts   # Event listeners and emitters (extracted side-effects)
│   └── domain-cache.service.ts   # Cache management (Redis interactions)
└── domain.module.ts
```
*Rule Base for Splitting:*
- Length rule: Services over 600 lines should be evaluated for splitting.
- Responsibility rule: Separate CRUD, Query, Permissions, and Caching into discrete services.

### 2. Managing Hidden Side Effects (Events & Observers)
Fat services are dangerous because core logic is mixed with secondary tasks (updating view counts, invalidating caches, sending notifications).

*   **Action:** Use NestJS `EventEmitter2`.
*   **Implementation:** The core command service only updates the database and emits an event (e.g., `PostCreatedEvent`). Separate event listeners (`domain-event.service.ts` or `notifications.service.ts`) handle the side effects asynchronously.
*   **Version Control Events:** To prevent cache misses or broken consumer logic when renaming variables, version event payloads (e.g., `post.created.v1`, `post.created.v2`) and support both during the transition period.

### 3. Resolving Circular Dependencies (`forwardRef`)
`forwardRef` is a code smell indicating that two modules are too tightly coupled.
*   **Action:** Introduce a shared module or an intermediary service.
*   **Alternative:** Use Domain Events. Instead of Module A calling Module B directly (and vice versa), Module A emits an event that Module B listens to.

### 4. Ubiquitous Language & Naming Conventions
Align variable names, DTO fields, and method names with actual business actions. Before beginning refactoring, **create a Domain Dictionary** mapping old generic terms to new domain terms (e.g. `targetUserId` -> `memberIdToBan`).

*   **API Boundary (DTOs):** Keep the external DTO properties exactly the same to maintain backwards compatibility. If API fields must change, communicate in advance via shared contract documents and perform cross-platform syncs.
*   **Service Boundary:** Controller acts as the adapter, mapping the generic DTO fields to the specific domain variables before invoking the service.
    *   *Bad:* `function ban(targetUserId: string)`
    *   *Good:* `function banUser(accountIdToBan: string)`
*   **SQL & Raw Queries:** IDE "Rename Symbol" features are blind to raw strings in TypeORM `QueryBuilder` (e.g. `select("... as targetUserId")`). These must be manually added to a verification checklist.

### 5. Custom Repositories for DB Logic
Move complex `QueryBuilder` logic out of services and into Custom Repositories.
*   **Benefit:** Services become pure TS logic representing business rules, making them highly testable. Repositories handle the SQL/TypeORM specifics.

## 6. Multi-Platform Synchronization (Web, iOS, Android)
Backend refactoring does not happen in a vacuum. Even if the internal logic changes, any modification to DTOs, response structures, or error codes significantly impacts cross-platform clients.

### 6.1. Typed API Contracts (The Single Source of Truth)
- **Action:** If using an OpenAPI/Swagger generator or shared TypeScript types (e.g., in a monorepo workspace for the web frontend), all backend DTO changes **must** be published and strictly versioned.
- **Mobile Teams (iOS/AOS):** Mobile clients usually define their type models manually or via generation (e.g., Swift Codable, Kotlin Serialization). If a field name is changed from `authorId` to `writerId` without backward compatibility mapping in the backend Controller, **the mobile apps will crash in production.**
- **Rule:** DTOs are "Contracts." Treat them as immutable external interfaces. Any breaking change to a DTO must trigger a major version bump in the API path (e.g., `/v2/posts`).

### 6.2. Cross-Workspace CI/CD Validation
- **Action:** Before merging any backend PR, an automated or manual check must verify that the frontend web app and mobile app builds still pass using the updated API definitions.
- **Testing:** Integrate contract testing (e.g., Pact) or at least run the frontend integration tests against a staging instance of the refactored backend branch.

### 6.3. Coordinated Deployment Strategies
- **Action:** Backend updates that introduce new optional fields or change how errors are reported must be deployed **before** the client apps are updated to depend on them (Backward Compatibility).
- **Graceful Degradation:** The backend must handle older mobile app versions that still send legacy payload structures until those app versions fall below the minimum supported threshold.

## PR Strategy & Verification
Safe refactoring demands extremely small, isolated bounds.

1.  **Strict PR Segmentation:** Never mix operations. One PR should handle "Renaming", the next PR handles "Structural Splitting", and another handles "Behavioral Changes".
2.  **Module-by-Module Progression:** Extract domains sequentially (`posts` -> `users` -> `comments`). Do not attempt a global renaming across all modules at once.
3.  **Deprecation Lifecycles:** When creating backward compatible mapping layers, set explicit deprecation dates or threshold metric conditions (e.g. "remove when log hits drop to 0 for 7 days").
4.  **Two-Tier Contract Testing (Preventing "False Positives"):**
    - **Problem:** If you only test via the external legacy Controller (E2E), the mapping layer might hide bugs in the *new* refactored service logic. The test passes, but the core is a mess.
    - **Tier 1 (External E2E):** Existing E2E tests + API snapshot tests ensure the *legacy payload* (DTO) still works and returns the exact same format to clients.
    - **Tier 2 (Internal Service Unit/Integration):** You MUST write isolated tests for the *newly refactored `CommandService` and `QueryService`* using the strictly typed, new Domain language. Bypass the Controller and legacy DTO mapping layer entirely. This proves the *new* code actually works correctly on its own.

## Checklists for Refactoring a Module
- [ ] Is the Domain Dictionary created and shared? (e.g., mapping prohibited terms to recommended terms).
- [ ] Are external API DTOs completely unmodified to passing snapshot/OpenAPI diffs?
- [ ] Are raw strings and QueryBuilder aliases (`select("... as ...")`) manually checked and updated?
- [ ] Are all read operations moved to a `QueryService`?
- [ ] Are all write operations moved to a `CommandService`?
- [ ] Are secondary actions (emails, cache, stats) decoupled using `EventEmitter2` with versioned event payloads if changed?
- [ ] Emitting `forwardRef` warning check: Is the count of `forwardRef` zero (or dropping)?
- [ ] Are complex DB queries isolated in a Custom Repository?
- [ ] Have deprecation conditions (date/metric) been documented for any adapter/legacy layers?
