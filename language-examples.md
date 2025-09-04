# 🚀 30개 이상 프로그래밍 언어 신택스 하이라이팅 완벽 지원

VSCode Dark+ 테마로 구현된 아름다운 코드 블록을 확인해보세요! 이제 Swift, Kotlin, Flutter, Go, Ruby, Java 등 30개 이상의 언어를 완벽하게 지원합니다.

## 🍎 iOS 개발 - Swift

Swift는 Apple의 iOS, macOS 앱 개발을 위한 현대적인 언어입니다:

```swift
// Swift - iOS 앱 개발
import UIKit

class ViewController: UIViewController {
    @IBOutlet weak var titleLabel: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let greeting = "Hello, Swift!"
        titleLabel.text = greeting
        
        // 배열과 클로저 예제
        let numbers = [1, 2, 3, 4, 5]
        let doubled = numbers.map { $0 * 2 }
        print("Doubled: \(doubled)")
    }
}
```

## 🤖 Android 개발 - Kotlin

Kotlin은 Android 공식 개발 언어로, 간결하고 안전합니다:

```kotlin
// Kotlin - Android 앱 개발
package com.example.myapp

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 데이터 클래스 예제
        data class User(val name: String, val age: Int)
        
        val users = listOf(
            User("Alice", 25),
            User("Bob", 30)
        )
        
        users.forEach { user ->
            println("${user.name} is ${user.age} years old")
        }
    }
}
```

## 🎯 Flutter/Dart - 크로스플랫폼

Flutter는 하나의 코드베이스로 iOS와 Android 앱을 동시에 개발합니다:

```dart
// Dart - Flutter 크로스플랫폼 앱
import 'package:flutter/material.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(title: 'Flutter Demo Home'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  final String title;
  MyHomePage({required this.title});
  
  @override
  _MyHomePageState createState() => _MyHomePageState();
}
```

## ⚡ Go (Golang) - 클라우드 네이티브

Go는 Google에서 개발한 시스템 프로그래밍 언어입니다:

```go
// Go - 고성능 백엔드 개발
package main

import (
    "fmt"
    "net/http"
    "encoding/json"
)

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

func main() {
    http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
        users := []User{
            {ID: 1, Name: "Alice"},
            {ID: 2, Name: "Bob"},
        }
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(users)
    })
    
    fmt.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
```

## 💎 Ruby on Rails

Ruby는 생산성이 높은 웹 개발 언어입니다:

```ruby
# Ruby on Rails - 웹 애플리케이션
class UsersController < ApplicationController
  before_action :set_user, only: [:show, :edit, :update, :destroy]
  
  def index
    @users = User.all
  end
  
  def create
    @user = User.new(user_params)
    
    if @user.save
      redirect_to @user, notice: 'User was successfully created.'
    else
      render :new
    end
  end
  
  private
  
  def user_params
    params.require(:user).permit(:name, :email, :password)
  end
end
```

## ☕ Java - Enterprise

Java는 대규모 엔터프라이즈 애플리케이션 개발의 표준입니다:

```java
// Java - Spring Boot 애플리케이션
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
@RestController
public class DemoApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
    
    @GetMapping("/api/hello")
    public Map<String, String> hello(@RequestParam(defaultValue = "World") String name) {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hello, " + name + "!");
        response.put("timestamp", Instant.now().toString());
        return response;
    }
}
```

## 🔷 C# (.NET)

C#은 Microsoft의 강력한 객체지향 언어입니다:

```csharp
// C# - ASP.NET Core Web API
using Microsoft.AspNetCore.Mvc;

namespace MyApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;
        
        public UsersController(IUserService userService)
        {
            _userService = userService;
        }
        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            var users = await _userService.GetAllUsersAsync();
            return Ok(users);
        }
        
        [HttpPost]
        public async Task<ActionResult<User>> CreateUser(CreateUserDto dto)
        {
            var user = await _userService.CreateUserAsync(dto);
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
    }
}
```

## 🐘 PHP - 웹 개발

PHP는 가장 널리 사용되는 웹 개발 언어 중 하나입니다:

```php
<?php
// PHP - Laravel 프레임워크
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        $users = User::with('posts')
            ->where('active', true)
            ->orderBy('created_at', 'desc')
            ->paginate(10);
            
        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users'
        ]);
        
        $user = User::create($validated);
        
        return response()->json($user, 201);
    }
}
```

## 🦀 Rust - 시스템 프로그래밍

Rust는 메모리 안전성을 보장하는 시스템 프로그래밍 언어입니다:

```rust
// Rust - 안전한 시스템 프로그래밍
use actix_web::{web, App, HttpServer, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

async fn get_users() -> Result<impl Responder> {
    let users = vec![
        User {
            id: 1,
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
        },
        User {
            id: 2,
            name: "Bob".to_string(),
            email: "bob@example.com".to_string(),
        },
    ];
    
    Ok(HttpResponse::Ok().json(users))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/api/users", web::get().to(get_users))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

## 🐍 Python - AI/ML

Python은 데이터 사이언스와 AI 개발의 표준입니다:

```python
# Python - FastAPI 백엔드
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio

app = FastAPI()

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None

@app.get("/api/users", response_model=List[User])
async def get_users():
    users = [
        User(id=1, name="Alice", email="alice@example.com", age=25),
        User(id=2, name="Bob", email="bob@example.com", age=30)
    ]
    return users

@app.post("/api/users", response_model=User)
async def create_user(user: User):
    # 비동기 DB 저장 로직
    await asyncio.sleep(0.1)
    return user
```

## 🌐 TypeScript - Modern Web

TypeScript는 타입 안정성을 제공하는 JavaScript의 상위 집합입니다:

```typescript
// TypeScript - React + Next.js
import { useState, useEffect } from 'react';
import { User, Post } from '@/types';

interface DashboardProps {
  userId: string;
}

export default function Dashboard({ userId }: DashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, postsRes] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch(`/api/users/${userId}/posts`)
        ]);
        
        const userData = await userRes.json();
        const postsData = await postsRes.json();
        
        setUser(userData);
        setPosts(postsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [userId]);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}!</h1>
      <PostList posts={posts} />
    </div>
  );
}
```

## 📊 SQL - 데이터베이스

SQL은 데이터베이스 관리의 표준 언어입니다:

```sql
-- SQL - PostgreSQL 복잡한 쿼리 예제
WITH user_stats AS (
  SELECT 
    u.id,
    u.username,
    COUNT(DISTINCT p.id) as post_count,
    COUNT(DISTINCT c.id) as comment_count,
    AVG(p.view_count) as avg_views
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  LEFT JOIN comments c ON u.id = c.user_id
  WHERE u.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY u.id, u.username
)
SELECT 
  us.*,
  RANK() OVER (ORDER BY us.post_count DESC) as post_rank,
  CASE 
    WHEN us.post_count > 10 THEN 'Active'
    WHEN us.post_count > 5 THEN 'Regular'
    ELSE 'Casual'
  END as user_type
FROM user_stats us
ORDER BY us.post_count DESC
LIMIT 100;
```

## 🐳 Docker - 컨테이너

Docker는 애플리케이션 컨테이너화의 표준입니다:

```dockerfile
# Dockerfile - Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS dev-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## ⚙️ YAML - 설정 파일

YAML은 설정 파일의 표준 포맷입니다:

```yaml
# Kubernetes Deployment 설정
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-blog-app
  labels:
    app: blog
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog
  template:
    metadata:
      labels:
        app: blog
    spec:
      containers:
      - name: blog-backend
        image: myblog:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 🛠 Bash - 자동화 스크립트

Bash는 시스템 자동화의 핵심 도구입니다:

```bash
#!/bin/bash
# 배포 자동화 스크립트

set -e # 에러 발생시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# 환경 변수 체크
if [ -z "$DEPLOY_ENV" ]; then
    echo -e "${RED}Error: DEPLOY_ENV is not set${NC}"
    exit 1
fi

# 빌드 실행
echo -e "${YELLOW}Building application...${NC}"
npm run build

# 테스트 실행
echo -e "${YELLOW}Running tests...${NC}"
npm test

# 도커 이미지 빌드
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t myblog:$BUILD_NUMBER .

# 배포
if [ "$DEPLOY_ENV" == "production" ]; then
    echo -e "${GREEN}Deploying to production...${NC}"
    kubectl apply -f k8s/production/
else
    echo -e "${GREEN}Deploying to staging...${NC}"
    kubectl apply -f k8s/staging/
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
```

## 🌈 GraphQL - API 쿼리

GraphQL은 현대적인 API 쿼리 언어입니다:

```graphql
# GraphQL Schema & Queries
type User {
  id: ID!
  username: String!
  email: String!
  posts: [Post!]!
  followers: [User!]!
  following: [User!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  likes: Int!
  viewCount: Int!
  tags: [String!]!
  publishedAt: DateTime
}

type Query {
  # 사용자 조회
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  
  # 포스트 조회
  post(id: ID!): Post
  posts(
    authorId: ID
    tag: String
    sortBy: SortOrder = NEWEST
    limit: Int = 20
  ): [Post!]!
}

type Mutation {
  # 포스트 생성
  createPost(input: CreatePostInput!): Post!
  
  # 포스트 수정
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  
  # 좋아요
  likePost(postId: ID!): Post!
}
```

## 🔧 Nginx 설정

Nginx는 고성능 웹 서버입니다:

```nginx
# Nginx 설정 - 리버스 프록시와 로드 밸런싱
upstream backend {
    least_conn;
    server backend1.example.com:3000 weight=5;
    server backend2.example.com:3000 weight=3;
    server backend3.example.com:3000 backup;
}

server {
    listen 80;
    listen [::]:80;
    server_name myblog.com www.myblog.com;
    
    # SSL 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name myblog.com;
    
    # SSL 설정
    ssl_certificate /etc/ssl/certs/myblog.crt;
    ssl_certificate_key /etc/ssl/private/myblog.key;
    
    # 정적 파일 캐싱
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # API 프록시
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📝 Markdown

Markdown은 문서 작성의 표준입니다:

```markdown
# 프로젝트 README

## 📋 프로젝트 소개

**MyBlog**는 Next.js와 NestJS로 구축된 현대적인 블로그 플랫폼입니다.

### ✨ 주요 기능

- 🔐 **인증**: JWT 기반 보안 인증
- 📝 **에디터**: TipTap 기반 리치 텍스트 에디터
- 🎨 **테마**: 다크 모드 지원
- 🚀 **성능**: SSR/SSG 최적화

### 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | NestJS, PostgreSQL, TypeORM |
| DevOps | Docker, Kubernetes, GitHub Actions |

### 📦 설치 방법

\`\`\`bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
\`\`\`

> **Note**: Node.js 18.0 이상이 필요합니다.
```

## 🎉 마무리

이제 30개 이상의 프로그래밍 언어에 대해 아름다운 VSCode Dark+ 테마의 신택스 하이라이팅을 지원합니다! 

각 언어별로 최적화된 색상 스키마가 적용되어 있으며, 코드의 가독성이 크게 향상되었습니다.

### 지원 언어 목록

**웹 개발**: JavaScript, TypeScript, HTML, CSS, JSX, TSX  
**모바일**: Swift, Kotlin, Dart, Objective-C, Java  
**백엔드**: Go, Ruby, Python, PHP, Rust, C#  
**DevOps**: Docker, Bash, YAML, Nginx  
**데이터**: SQL, GraphQL, JSON, XML  
**기타**: Markdown, INI, TOML

모든 언어가 완벽하게 지원되며, 지속적으로 더 많은 언어를 추가할 예정입니다! 🚀