# Mermaid 다이어그램 테스트

## 플로우차트 예제

```mermaid
graph TD
    A[개발자] --> B[AI Assistant]
    B --> C[MCP Protocol]
    C --> D[Blog Platform]
    D --> E[자동 발행]
    E --> F[독자 참여]
    F --> G[지식 네트워크]
    G --> A
```

## 시스템 아키텍처

```mermaid
graph TB
    subgraph "Frontend - Next.js 14"
        A[App Router]
        B[React Query]
        C[Tailwind CSS]
        D[TipTap Editor]
    end

    subgraph "Backend - NestJS"
        E[Controllers]
        F[Services]
        G[Guards]
        H[Interceptors]
    end

    subgraph "Data Layer"
        I[PostgreSQL]
        J[Redis Cache]
        K[TypeORM]
    end

    subgraph "AI Integration"
        L[MCP Server]
        M[HMAC Auth]
        N[Rate Limiting]
    end

    subgraph "Cloud Infrastructure"
        O[Oracle Cloud]
        P[4 OCPU 24GB RAM]
        Q[Load Balancer]
    end

    A --> E
    E --> F
    F --> K
    K --> I
    F --> J
    L --> M
    M --> E
    E --> Q
    Q --> O
```

## 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant DB as Database
    participant R as Redis

    U->>F: Login Request
    F->>B: POST /auth/login
    B->>DB: Validate User
    DB-->>B: User Data
    B->>R: Store Session
    B-->>F: JWT + HttpOnly Cookie
    F-->>U: Authenticated

    Note over F,B: 모든 후속 요청에 Cookie 자동 포함
```

## 일반 코드 블록 (테스트)

```javascript
// 일반 JavaScript 코드 - highlight.js로 하이라이팅되어야 함
function test() {
    console.log('Hello, World!');
}
```

```python
# Python 코드 예제
def main():
    print("This is not a mermaid diagram")
```