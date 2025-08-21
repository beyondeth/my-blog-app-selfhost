---
title: "Claude Code CLI 백그라운드 블로그 자동 포스팅 시스템 설계"
tags: []
date: 2025-08-18T03:04:36.738392
source: claude-code-background-posting-system.md
---

# Claude Code CLI 백그라운드 블로그 자동 포스팅 시스템 설계

## 🎯 문제 정의

현재 Claude Code CLI에서 blog MCP 서버를 통해 자동 포스팅을 할 때, 동기적으로 실행되어 완료까지 대기해야 하는 문제가 있습니다. 이로 인해 포스팅 진행 중 다른 작업을 수행할 수 없어 생산성이 저하됩니다.

### 핵심 문제점
- 동기적 실행으로 인한 대기 시간 발생
- 포스팅 진행 중 다른 작업 불가
- 프로세스 모니터링 어려움
- 장시간 작업 시 세션 타임아웃 위험

## 💡 솔루션 아키텍처

### 1. Claude Code 백그라운드 실행 아키텍처

백그라운드 실행을 위한 멀티레이어 접근 방식을 설계했습니다:

#### Layer 1: Immediate Background (즉시 백그라운드)
```bash
# Bash run_in_background 활용
claude code "블로그 포스팅 작업" --run-in-background
```

#### Layer 2: Task Delegation (태스크 위임)
```typescript
// Task tool을 활용한 비동기 위임
{
  subagent_type: "rapid-prototyper",
  prompt: "블로그 포스팅 자동화",
  async: true,
  callback: "notification"
}
```

#### Layer 3: Service Architecture (서비스 아키텍처)
```yaml
# systemd service 또는 pm2 프로세스 관리
blog-posting-service:
  type: daemon
  restart: on-failure
  exec: claude-code-posting-worker
```

## 🏗️ 구현 방법별 상세 설계

### 방법 1: Claude Code Native Background Execution

가장 간단하고 즉시 적용 가능한 방법입니다.

```bash
#!/bin/bash
# blog-posting-background.sh

# 백그라운드 실행 함수
run_blog_posting() {
    # Bash tool의 run_in_background 파라미터 활용
    claude code <<EOF
        /task "블로그 자동 포스팅" --delegate auto --async
        mcp__my-blog__authenticate
        mcp__my-blog__create_post_from_file $1
EOF &
    
    # 프로세스 ID 저장
    echo $! > /tmp/blog-posting.pid
}

# 상태 확인 함수
check_status() {
    if [ -f /tmp/blog-posting.pid ]; then
        pid=$(cat /tmp/blog-posting.pid)
        if ps -p $pid > /dev/null; then
            echo "포스팅 진행 중... (PID: $pid)"
        else
            echo "포스팅 완료"
        fi
    fi
}
```

### 방법 2: Task Delegation Architecture

Claude Code의 Task tool을 활용한 지능적인 위임 시스템입니다.

```typescript
// blog-posting-delegator.ts
interface BlogPostingTask {
  type: 'sequential' | 'parallel';
  posts: string[];
  strategy: 'batch' | 'individual';
}

class BlogPostingDelegator {
  async executeBatchPosting(posts: string[]): Promise<void> {
    // Task tool을 활용한 sub-agent delegation
    const tasks = posts.map(post => ({
      subagent_type: 'rapid-prototyper',
      prompt: `블로그 포스팅: ${post}`,
      description: `Post ${post}`,
      parallel: true
    }));
    
    // 병렬 실행
    await Promise.all(tasks.map(task => this.delegateTask(task)));
  }
  
  private async delegateTask(task: any) {
    // Claude Code Task API 호출
    return await executeTask(task);
  }
}
```

### 방법 3: MCP Server as Background Service

프로덕션 환경에 적합한 데몬 서비스 방식입니다.

```python
# blog_posting_daemon.py
import asyncio
import os
from pathlib import Path
from typing import List
import inotify

class BlogPostingDaemon:
    def __init__(self, watch_dir: str, queue_dir: str):
        self.watch_dir = Path(watch_dir)
        self.queue_dir = Path(queue_dir)
        self.posting_queue: List[Path] = []
        
    async def watch_for_posts(self):
        """디렉토리 모니터링 및 자동 큐잉"""
        watcher = inotify.adapters.Inotify()
        watcher.add_watch(str(self.watch_dir))
        
        for event in watcher.event_gen(yield_nones=False):
            (_, type_names, path, filename) = event
            if 'IN_CREATE' in type_names and filename.endswith('.md'):
                await self.queue_post(Path(path) / filename)
    
    async def queue_post(self, file_path: Path):
        """포스팅 큐에 추가"""
        self.posting_queue.append(file_path)
        await self.process_queue()
    
    async def process_queue(self):
        """백그라운드에서 큐 처리"""
        while self.posting_queue:
            post = self.posting_queue.pop(0)
            asyncio.create_task(self.post_to_blog(post))
    
    async def post_to_blog(self, post_path: Path):
        """MCP를 통한 블로그 포스팅"""
        # MCP 호출 로직
        pass
```

## 📊 모니터링 및 알림 시스템

### 실시간 진행 상황 모니터링

React 기반의 웹 대시보드를 통해 포스팅 진행 상황을 실시간으로 모니터링할 수 있습니다.

```typescript
// monitoring-dashboard.tsx
interface PostingStatus {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

const MonitoringDashboard: React.FC = () => {
  const [statuses, setStatuses] = useState<PostingStatus[]>([]);
  
  useEffect(() => {
    // WebSocket 연결로 실시간 업데이트
    const ws = new WebSocket('ws://localhost:8080/status');
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setStatuses(prev => updateStatus(prev, update));
    };
    
    return () => ws.close();
  }, []);
  
  return (
    <div className="monitoring-dashboard">
      {statuses.map(status => (
        <PostingCard key={status.id} status={status} />
      ))}
    </div>
  );
};
```

### 알림 시스템

다양한 채널을 통한 알림을 지원합니다.

```python
# notification_system.py
class NotificationService:
    def __init__(self):
        self.channels = {
            'terminal': self.notify_terminal,
            'desktop': self.notify_desktop,
            'webhook': self.notify_webhook,
            'email': self.notify_email
        }
    
    async def notify_terminal(self, message: str):
        """터미널 알림 (tmux, screen 지원)"""
        print(f"\033[92m✅ {message}\033[0m")
        # tmux send-keys 활용
        os.system(f'tmux display-message "{message}"')
    
    async def notify_desktop(self, message: str):
        """데스크톱 알림 (OS 네이티브)"""
        if sys.platform == 'darwin':  # macOS
            os.system(f"""
                osascript -e 'display notification "{message}" \
                with title "Blog Posting"'
            """)
        elif sys.platform == 'linux':
            os.system(f'notify-send "Blog Posting" "{message}"')
```

## 🚀 실행 계획

### Phase 1: Quick Win (즉시 적용 가능 - 5분 내 구현)

```bash
# 1. 간단한 백그라운드 실행
claude code "mcp__my-blog__create_post_from_file ./post.md" &

# 2. nohup 활용 (세션 종료 후에도 계속)
nohup claude code "mcp__my-blog__create_post_from_file ./post.md" > posting.log 2>&1 &

# 3. screen/tmux 활용
screen -dmS blog-posting claude code "mcp__my-blog__create_post_from_file ./post.md"
```

### Phase 2: Enhanced Solution (중급 - 30분)

스마트 래퍼 스크립트를 구현하여 상태 추적과 에러 처리를 개선합니다.

```python
#!/usr/bin/env python3
# smart-blog-poster.py

import subprocess
import sys
import time
import os
from pathlib import Path
import json

class SmartBlogPoster:
    def __init__(self):
        self.status_file = Path.home() / '.blog-posting-status.json'
        self.load_status()
    
    def post_async(self, file_path):
        """비동기로 포스트 실행"""
        post_id = str(time.time())
        
        # 백그라운드 프로세스 시작
        process = subprocess.Popen([
            'claude', 'code',
            f'mcp__my-blog__create_post_from_file {file_path}'
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
           start_new_session=True)
        
        # 상태 저장
        self.status['posts'].append({
            'id': post_id,
            'file': file_path,
            'pid': process.pid,
            'status': 'running',
            'started': time.time()
        })
        self.save_status()
        
        print(f"✅ 포스팅 시작: {file_path} (PID: {process.pid})")
        return post_id
```

### Phase 3: Production Ready (고급)

Docker와 Kubernetes를 활용한 프로덕션 레벨 솔루션입니다.

```yaml
# docker-compose.yml
version: '3.8'
services:
  blog-posting-worker:
    build: ./worker
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - MCP_SERVER_URL=http://mcp-server:8080
    volumes:
      - ./posts:/posts
      - ./logs:/logs
    depends_on:
      - redis
      - mcp-server
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  monitoring:
    build: ./monitoring
    ports:
      - "3000:3000"
    depends_on:
      - redis
```

## 💡 최종 권장 솔루션

### Claude Code Native Solution (가장 간단하고 효과적)

```bash
# 백그라운드 실행 with BashOutput monitoring
claude code << 'EOF'
# 백그라운드 포스팅 시작
bash --run-in-background "
  for file in ./posts/*.md; do
    echo '🚀 Processing: $file'
    claude code 'mcp__my-blog__create_post_from_file $file'
    echo '✅ Completed: $file'
  done
"

# 다른 작업 계속 가능
# BashOutput으로 진행상황 확인
EOF
```

### 최적 워크플로우

1. **포스트 파일 준비** → `./posts/` 디렉토리에 마크다운 파일 배치
2. **백그라운드 실행** → 위 스크립트 실행
3. **다른 작업 진행** → Claude Code에서 다른 개발 작업 계속
4. **상태 모니터링** → BashOutput 또는 로그 파일로 확인
5. **완료 알림** → 데스크톱 알림 또는 터미널 메시지

## 🎯 Pro Tips

1. **세션 유지**: `tmux` 또는 `screen` 사용으로 SSH 연결 끊어져도 계속 실행
2. **에러 처리**: 실패한 포스트만 재시도하는 로직 구현
3. **스케줄링**: `cron` 또는 `systemd timer`로 정기 실행
4. **모니터링**: Grafana나 간단한 웹 대시보드로 시각화

## 📌 실행 계획 요약

### 즉시 실행 가능한 3가지 방법:

1. **가장 간단한 방법 (1분)**
   ```bash
   nohup claude code "mcp__my-blog__create_post ./post.md" &
   ```

2. **Claude Code Native (권장)**
   ```bash
   # Bash tool의 run_in_background 활용
   claude code --execute "bash --run-in-background 'posting-script.sh'"
   ```

3. **Task Delegation**
   ```bash
   claude code "/task '블로그 포스팅' --delegate auto --async"
   ```

### 선택 가이드:
- **단순 포스팅** → 방법 1
- **모니터링 필요** → 방법 2  
- **대량 포스팅** → 방법 3

이제 포스팅이 백그라운드에서 실행되는 동안 다른 작업을 자유롭게 할 수 있습니다! 🚀

---

*Tags: Claude Code, MCP, Background Processing, Blog Automation, DevOps*