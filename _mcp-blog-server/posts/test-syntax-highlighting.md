# 🌈 신택스 하이라이팅 테스트 - 30+ 프로그래밍 언어 지원

VSCode Dark+ 테마를 적용한 신택스 하이라이팅을 테스트해보겠습니다. 각 언어별로 고유한 색상 스킴이 적용되어 있습니다.

## 📱 모바일 개발 언어

### Swift (iOS)
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

### Kotlin (Android)
```kotlin
// Kotlin - Android 앱 개발
package com.example.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // 코루틴 예제
        lifecycleScope.launch {
            val data = fetchDataFromAPI()
            binding.textView.text = data
        }
    }
    
    suspend fun fetchDataFromAPI(): String {
        return withContext(Dispatchers.IO) {
            "Hello, Kotlin!"
        }
    }
}
```

### Dart/Flutter
```dart
// Flutter - 크로스 플랫폼 앱 개발
import 'package:flutter/material.dart';

class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;
  
  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Flutter Demo'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text('You have pushed the button:'),
            Text(
              '$_counter times',
              style: Theme.of(context).textTheme.headline4,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        child: Icon(Icons.add),
      ),
    );
  }
}
```

### Java
```java
// Java - Android & Spring Boot
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
    public ResponseEntity<Map<String, String>> hello(@RequestParam String name) {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hello, " + name);
        response.put("timestamp", LocalDateTime.now().toString());
        
        return ResponseEntity.ok(response);
    }
}
```

## 💻 백엔드 개발 언어

### Go (Golang)
```go
// Go - 고성능 백엔드 서버
package main

import (
    "fmt"
    "net/http"
    "encoding/json"
    "github.com/gorilla/mux"
)

type User struct {
    ID       int    `json:"id"`
    Name     string `json:"name"`
    Email    string `json:"email"`
}

func main() {
    router := mux.NewRouter()
    
    router.HandleFunc("/api/users", getUsers).Methods("GET")
    router.HandleFunc("/api/user/{id}", getUser).Methods("GET")
    
    fmt.Println("Server starting on port 8080...")
    http.ListenAndServe(":8080", router)
}

func getUsers(w http.ResponseWriter, r *http.Request) {
    users := []User{
        {ID: 1, Name: "John", Email: "john@example.com"},
        {ID: 2, Name: "Jane", Email: "jane@example.com"},
    }
    
    json.NewEncoder(w).Encode(users)
}
```

### Ruby (Ruby on Rails)
```ruby
# Ruby on Rails - 웹 애플리케이션 프레임워크
class UsersController < ApplicationController
  before_action :set_user, only: [:show, :update, :destroy]
  
  # GET /users
  def index
    @users = User.all
    render json: @users
  end
  
  # POST /users
  def create
    @user = User.new(user_params)
    
    if @user.save
      render json: @user, status: :created
    else
      render json: @user.errors, status: :unprocessable_entity
    end
  end
  
  private
  
  def set_user
    @user = User.find(params[:id])
  end
  
  def user_params
    params.require(:user).permit(:name, :email, :password)
  end
end
```

### Python
```python
# Python - FastAPI 웹 프레임워크
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio

app = FastAPI()

class User(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool = True

# 비동기 데이터베이스 함수
async def get_user_from_db(user_id: int) -> Optional[User]:
    await asyncio.sleep(0.1)  # DB 쿼리 시뮬레이션
    return User(id=user_id, name="John Doe", email="john@example.com")

@app.get("/users/{user_id}")
async def read_user(user_id: int):
    user = await get_user_from_db(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/")
async def create_user(user: User):
    # 유저 생성 로직
    return {"message": "User created", "user": user}
```

### C# (.NET)
```csharp
// C# - ASP.NET Core Web API
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace MyApp.Controllers
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
        
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _userService.GetUserByIdAsync(id);
            
            if (user == null)
            {
                return NotFound();
            }
            
            return Ok(user);
        }
        
        [HttpPost]
        public async Task<ActionResult<User>> CreateUser(UserDto userDto)
        {
            var user = await _userService.CreateUserAsync(userDto);
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
    }
}
```

### PHP
```php
// PHP - Laravel Framework
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        $users = User::paginate(10);
        return response()->json($users);
    }
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
        ]);
        
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);
        
        return response()->json([
            'message' => 'User created successfully',
            'user' => $user
        ], 201);
    }
}
```

### Rust
```rust
// Rust - 고성능 시스템 프로그래밍
use actix_web::{web, App, HttpResponse, HttpServer};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

async fn get_users() -> HttpResponse {
    let users = vec![
        User {
            id: 1,
            name: String::from("Alice"),
            email: String::from("alice@example.com"),
        },
        User {
            id: 2,
            name: String::from("Bob"),
            email: String::from("bob@example.com"),
        },
    ];
    
    HttpResponse::Ok().json(users)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting server on http://127.0.0.1:8080");
    
    HttpServer::new(|| {
        App::new()
            .route("/api/users", web::get().to(get_users))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

## 🌐 웹 개발 언어

### TypeScript
```typescript
// TypeScript - 타입 안정성을 갖춘 JavaScript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

class UserService {
  private users: Map<number, User> = new Map();
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const id = Date.now();
    const user: User = {
      id,
      ...userData,
    };
    
    this.users.set(id, user);
    return user;
  }
  
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
}
```

### React (JSX/TSX)
```jsx
// React - UI 컴포넌트 라이브러리
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

const UserProfile = ({ userId }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {isEditing ? (
        <EditForm user={user} onSave={handleSave} />
      ) : (
        <Button onClick={() => setIsEditing(true)}>
          Edit Profile
        </Button>
      )}
    </div>
  );
};

export default UserProfile;
```

### GraphQL
```graphql
# GraphQL - API 쿼리 언어
type Query {
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  searchUsers(query: String!): [User!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateUserInput {
  name: String!
  email: String!
  password: String!
}
```

## 🛠 DevOps & 인프라

### Dockerfile
```dockerfile
# Docker - 컨테이너 정의
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 실행 단계
FROM node:18-alpine

WORKDIR /app

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Nginx Configuration
```nginx
# Nginx - 웹 서버 설정
server {
    listen 80;
    server_name example.com www.example.com;
    
    # SSL 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://backend:8080;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### YAML (Kubernetes)
```yaml
# Kubernetes - 컨테이너 오케스트레이션
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: app
        image: myapp:latest
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
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "0.5"
            memory: "256Mi"
```

### SQL
```sql
-- SQL - 데이터베이스 쿼리
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- 복잡한 쿼리 예제
SELECT 
    u.id,
    u.username,
    COUNT(p.id) as post_count,
    MAX(p.created_at) as last_post_date
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username
HAVING COUNT(p.id) > 0
ORDER BY post_count DESC
LIMIT 10;
```

### Bash
```bash
#!/bin/bash
# Bash - 자동화 스크립트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 확인
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
    log_info "NODE_ENV set to production"
fi

# 배포 스크립트
deploy() {
    log_info "Starting deployment..."
    
    # Git 최신 변경사항 가져오기
    git pull origin main
    
    # 의존성 설치
    npm ci --only=production
    
    # 빌드
    npm run build
    
    # PM2로 재시작
    pm2 restart app
    
    log_info "Deployment completed successfully!"
}

# 메인 실행
deploy
```

### JSON
```json
{
  "name": "my-blog-app",
  "version": "1.0.0",
  "description": "Modern blog application with syntax highlighting",
  "main": "index.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "jest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "highlight.js": "^11.9.0",
    "lowlight": "^3.0.0",
    "next": "^14.0.0",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
```

## 🎯 결론

이제 우리 블로그는 **30개 이상의 프로그래밍 언어**에 대한 신택스 하이라이팅을 지원합니다! 

### 주요 특징:
- 🎨 **VSCode Dark+ 테마** 기반 색상 스킴
- 🌈 **언어별 특화 색상** - 각 언어의 공식 IDE 테마 반영
- ⚡ **자동 언어 감지** - 코드 블록 언어 자동 인식
- 📱 **모바일 최적화** - 반응형 코드 블록 디자인

### 지원 언어 목록:
- **웹**: JavaScript, TypeScript, HTML, CSS, GraphQL
- **모바일**: Swift, Kotlin, Dart/Flutter, Objective-C, Java
- **백엔드**: Python, Go, Ruby, C#, PHP, Rust
- **DevOps**: Docker, Kubernetes, Nginx, Bash, SQL

이제 기술 블로그로서 완벽한 코드 표현력을 갖추게 되었습니다! 🚀