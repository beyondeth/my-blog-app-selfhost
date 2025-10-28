# 서버 보안 설정 가이드

## 📋 목차
- [개요](#개요)
- [보안 아키텍처](#보안-아키텍처)
- [설정된 보안 시스템](#설정된-보안-시스템)
- [차단 정책](#차단-정책)
- [설정 파일 위치](#설정-파일-위치)
- [운영 가이드](#운영-가이드)
- [트러블슈팅](#트러블슈팅)

---

## 개요

codebase.blog 프로덕션 서버의 보안 설정을 문서화합니다.

### 목표
- ✅ 악의적 공격자 자동 차단
- ✅ 일반 사용자/좋은 봇 보호
- ✅ 과도한 크롤링 방지
- ✅ 민감 파일 접근 차단
- ✅ 매일 보안 리포트 이메일 발송

### 적용 날짜
2025-10-28

---

## 보안 아키텍처

### 3중 방어 시스템

```
인터넷 사용자
    ↓
┌─────────────────────────────────┐
│ 1. Cloudflare (최전선)           │
│ - Bot Fight Mode                │
│ - DDoS Protection               │
│ - Rate Limiting (50 req/10s)    │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 2. Nginx (서버 1차 방어)         │
│ - 민감 파일 차단 (444 에러)      │
│ - Rate Limiting                 │
│ - SSL/TLS 종료                  │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 3. Fail2ban (서버 2차 방어)      │
│ - IP 기반 자동 차단              │
│ - 패턴 기반 공격 탐지            │
│ - 재범자 영구 차단               │
└─────────────────────────────────┘
    ↓
Backend (NestJS) → Database
```

---

## 설정된 보안 시스템

### 1. Nginx 민감 경로 차단

**목적:** 정상 사용자는 절대 접근하지 않는 파일에 대한 요청 즉시 차단

**차단 대상:**
```nginx
# /etc/nginx/sites-enabled/default

# 민감 파일
location ~ /\.(env|git|aws|htaccess)$ {
    return 444;  # 연결 즉시 종료
}

# WordPress 취약점
location ~ /(wp-config|wp-admin|wp-login|xmlrpc)\.php$ {
    return 444;
}
```

**444 에러 코드:** Nginx 특수 코드, TCP 연결을 즉시 종료하여 로그만 남기고 응답하지 않음

---

### 2. Fail2ban Jails (7개)

#### 2.1. nginx-security-scan
**목적:** 민감 파일 스캔 시도 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | .env, .git, .aws, wp-config, xmlrpc |
| 임계값 | 3회 / 5분 |
| 차단 시간 | 6시간 |
| 이메일 알림 | ✅ 발송 |

**좋은 봇 제외:** Googlebot, Bingbot, facebookexternalhit 등

---

#### 2.2. nginx-excessive-crawling
**목적:** 과도한 포스트 크롤링 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | 성공 요청 (200, 301, 302) |
| 임계값 | 100회 / 1분 |
| 차단 시간 | 6시간 |
| 이메일 알림 | ❌ 미발송 (일반 차단) |

**제외 대상:**
- 좋은 봇 (Googlebot, Bingbot 등)
- 정상 브라우저 (Chrome, Firefox, Safari, Edge)

**실제 시나리오:**
```python
# 악의적 크롤러 (차단됨)
for page in range(1, 1000):
    requests.get(f"/api/v1/posts?page={page}")
    time.sleep(0.5)  # 초당 2회 = 1분에 120회
```

---

#### 2.3. nginx-rate-limit-abuse
**목적:** Nginx Rate Limit을 무시하고 계속 시도하는 봇 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | 429 Too Many Requests 에러 |
| 임계값 | 20회 / 2분 |
| 차단 시간 | 1시간 |
| 이메일 알림 | ❌ 미발송 |

**정상 사용자 vs 봇:**
- 정상 사용자: 429 에러 받으면 멈춤
- 자동화 봇: 429 에러 무시하고 계속 시도 → 차단

---

#### 2.4. nginx-auth-failed
**목적:** 로그인 반복 실패 차단 (브루트포스 방어)

| 항목 | 값 |
|-----|---|
| 감지 패턴 | POST /api/v1/auth/login → 401 |
| 임계값 | 15회 / 10분 |
| 차단 시간 | 30분 |
| 이메일 알림 | ❌ 미발송 |

**일반 사용자 보호:**
- 비밀번호를 15번까지 틀려도 OK
- 10분 후 다시 15번 시도 가능
- 매우 관대한 정책

---

#### 2.5. recidive (재범자)
**목적:** 반복적으로 차단된 IP에 대한 더 긴 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | 1일 내 3회 이상 차단 |
| 차단 시간 | 1주일 |
| 이메일 알림 | ✅ 발송 |

---

#### 2.6. recidive-permanent (영구 차단)
**목적:** 지속적인 공격자 영구 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | 30일 내 5회 이상 차단 |
| 차단 시간 | 영구 (-1) |
| 이메일 알림 | ✅ 발송 |

---

#### 2.7. sshd (기존)
**목적:** SSH 무차별 대입 공격 차단

| 항목 | 값 |
|-----|---|
| 감지 패턴 | SSH 로그인 실패 |
| 임계값 | 5회 / 10분 |
| 차단 시간 | 1시간 |

---

### 3. 이메일 리포트

#### 즉시 알림 (중요 차단 발생 시)
- 민감 파일 스캔 차단
- 재범자 차단
- 영구 차단

**이메일 내용:**
- 차단된 IP 주소
- Whois 정보
- 로그 라인 (위반 내용)

#### 일일 리포트
**발송 시간:** 매일 한국시간 00:00 (UTC 15:00)

**이메일 주소:** info@codebase.blog

**리포트 내용:**
```
1. 현재 활성 Jail 목록
2. Jail별 차단 IP 상세
3. 오늘 차단된 IP (신규)
4. 영구 차단된 IP 목록
5. 차단 통계 (최근 7일)
6. 복구 방법 안내
```

---

## 차단 정책

### 정책 요약표

| 위반 유형 | 임계값 | 첫 차단 | 재범 | 영구 차단 |
|---------|--------|--------|------|----------|
| 민감 파일 스캔 | 3회/5분 | 6시간 | 1일 | 30일/5회 |
| 과도한 크롤링 | 100회/1분 | 6시간 | 1일 | 30일/5회 |
| 429 무시 | 20회/2분 | 1시간 | 6시간 | 30일/5회 |
| 로그인 실패 | 15회/10분 | 30분 | 1시간 | 30일/5회 |
| 재범자 | 3회/1일 | 1주 | - | - |

### 차단 시간 증가 (Bantime Increment)

```
1회 차단: 설정된 시간 (예: 6시간)
2회 차단: 12시간 (x2)
3회 차단: 24시간 (x4)
4회 차단: 48시간 (x8)
5회 차단: 영구 (recidive-permanent 발동)
```

**최대 차단 시간:** 4주 (28일)

---

### 보호 대상

#### ✅ 절대 차단 안 되는 대상

**좋은 봇 (SEO/소셜 미디어):**
```
Googlebot          # 구글 검색
Bingbot            # Bing 검색
facebookexternalhit # 페이스북 링크 미리보기
Twitterbot         # 트위터 카드
LinkedInBot        # 링크드인 공유
Slackbot           # 슬랙 링크 미리보기
Applebot           # 애플 검색
DuckDuckBot        # DuckDuckGo 검색
Baiduspider        # 바이두 검색
YandexBot          # Yandex 검색
```

**정상 브라우저:**
```
Mozilla/5.0 ... Chrome ...
Mozilla/5.0 ... Firefox ...
Mozilla/5.0 ... Safari ...
Mozilla/5.0 ... Edge ...
```

#### ❌ 차단되는 대상

**악의적 도구:**
```
masscan, nmap      # 포트 스캐너
sqlmap             # SQL injection 도구
nikto              # 취약점 스캐너
ZmEu, libwww       # 오래된 공격 도구
```

**행동 패턴:**
- 1분에 100회 이상 요청
- 민감 파일 반복 접근
- 429 에러 무시하고 계속 시도
- 로그인 15회 이상 실패

---

## 설정 파일 위치

### 서버 (158.178.236.98)

```
/etc/nginx/sites-enabled/default
  └─ 민감 경로 차단 설정

/etc/fail2ban/jail.local
  └─ Jail 설정 (차단 정책)

/etc/fail2ban/filter.d/
  ├─ nginx-security-scan.conf
  ├─ nginx-excessive-crawling.conf
  ├─ nginx-auth-failed.conf
  └─ nginx-limit-req.conf (기존)

/usr/local/bin/fail2ban-daily-report.sh
  └─ 일일 리포트 스크립트

/var/log/
  ├─ nginx/access.log         # Nginx 접근 로그
  ├─ nginx/error.log          # Nginx 에러 로그
  ├─ fail2ban.log             # Fail2ban 로그
  └─ fail2ban-report.log      # 리포트 실행 로그
```

### Crontab

```bash
# 한국시간 0시 = UTC 15시
0 15 * * * /usr/local/bin/fail2ban-daily-report.sh >> /var/log/fail2ban-report.log 2>&1
```

---

## 운영 가이드

### 기본 명령어

#### Fail2ban 상태 확인
```bash
# 전체 Jail 목록
sudo fail2ban-client status

# 특정 Jail 상세 정보
sudo fail2ban-client status nginx-security-scan

# 현재 차단된 IP 확인
sudo fail2ban-client status sshd
```

#### IP 차단/해제
```bash
# IP 수동 차단
sudo fail2ban-client set nginx-security-scan banip 1.2.3.4

# IP 차단 해제
sudo fail2ban-client unban 1.2.3.4

# 특정 Jail에서만 해제
sudo fail2ban-client set nginx-security-scan unbanip 1.2.3.4
```

#### 서비스 재시작
```bash
# Nginx 재시작
sudo systemctl reload nginx

# Fail2ban 재시작
sudo systemctl restart fail2ban

# 서비스 상태 확인
sudo systemctl status fail2ban
```

#### 로그 확인
```bash
# Fail2ban 최근 로그 (50줄)
sudo journalctl -u fail2ban.service -n 50

# 오늘 차단된 IP
sudo grep "$(date +%Y-%m-%d)" /var/log/fail2ban.log | grep "Ban"

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 액세스 로그에서 특정 IP
sudo grep "1.2.3.4" /var/log/nginx/access.log
```

#### 리포트
```bash
# 리포트 수동 발송
sudo /usr/local/bin/fail2ban-daily-report.sh

# 생성된 리포트 확인
cat /tmp/fail2ban-report-$(date +%Y%m%d).txt

# 리포트 실행 로그
tail -f /var/log/fail2ban-report.log
```

---

### 일반적인 시나리오

#### 시나리오 1: 사용자가 실수로 차단됨

**증상:** 사용자가 "사이트 접속이 안된다"고 보고

**확인:**
```bash
# 최근 차단된 IP 확인
sudo fail2ban-client status | grep "IP list"

# 특정 IP가 차단되었는지 확인
sudo iptables -L -n | grep "사용자IP"
```

**해결:**
```bash
# IP 차단 해제
sudo fail2ban-client unban 사용자IP

# 차단 해제 확인
sudo fail2ban-client status | grep "사용자IP"
```

**예방:**
- 신뢰할 수 있는 사용자 IP는 화이트리스트에 추가:
```bash
# /etc/fail2ban/jail.local [DEFAULT] 섹션에 추가
ignoreip = 127.0.0.1/8 ::1 신뢰하는IP
```

---

#### 시나리오 2: 공격자 확인

**일일 리포트에서 특정 IP가 계속 나타남**

**조사:**
```bash
# 해당 IP의 접근 패턴 확인
sudo grep "공격자IP" /var/log/nginx/access.log | tail -20

# Whois 정보 확인
whois 공격자IP | grep -E "(Country|OrgName)"

# Fail2ban 차단 이력
sudo grep "공격자IP" /var/log/fail2ban.log
```

**조치:**
```bash
# 즉시 영구 차단 (필요시)
sudo fail2ban-client set recidive-permanent banip 공격자IP

# 확인
sudo fail2ban-client status recidive-permanent
```

---

#### 시나리오 3: Cloudflare 우회 공격

**Cloudflare를 우회하고 직접 서버 IP로 접근**

**감지:**
```bash
# HTTP/1.1 요청 확인 (Cloudflare는 HTTP/2.0)
sudo grep "HTTP/1.1" /var/log/nginx/access.log | tail -20
```

**조치:**
- Fail2ban이 자동으로 차단
- 필요 시 Nginx에서 Cloudflare IP만 허용하도록 설정

---

#### 시나리오 4: 과도한 크롤링 확인

**특정 봇이 계속 크롤링**

**확인:**
```bash
# 상위 20개 IP의 요청 횟수
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# 특정 IP의 User-Agent 확인
sudo grep "의심스러운IP" /var/log/nginx/access.log | awk '{print $12}' | sort | uniq -c
```

**판단:**
- User-Agent가 Googlebot 등 → 좋은 봇, 차단 안됨
- User-Agent가 Python, curl 등 → 악의적, 자동 차단됨

---

## 트러블슈팅

### 문제 1: Fail2ban이 시작되지 않음

**증상:**
```bash
sudo systemctl status fail2ban
# ● fail2ban.service - Fail2Ban Service
#    Active: failed (Result: exit-code)
```

**원인:**
- jail.local 설정 오류
- filter 파일 문법 오류

**해결:**
```bash
# 설정 검증
sudo fail2ban-client -t

# 상세 로그 확인
sudo journalctl -u fail2ban.service -n 100

# 설정 파일 문법 확인
sudo fail2ban-regex /var/log/nginx/access.log /etc/fail2ban/filter.d/nginx-security-scan.conf
```

---

### 문제 2: Filter가 작동하지 않음

**증상:**
- 명백한 공격이지만 차단 안됨
- `Total failed: 0`

**원인:**
- failregex 패턴이 로그와 맞지 않음
- 로그 파일 경로 오류

**해결:**
```bash
# Filter 테스트
sudo fail2ban-regex /var/log/nginx/access.log /etc/fail2ban/filter.d/nginx-security-scan.conf

# 로그 파일 권한 확인
ls -la /var/log/nginx/access.log

# Fail2ban이 로그를 읽을 수 있는지 확인
sudo -u fail2ban cat /var/log/nginx/access.log | tail
```

---

### 문제 3: 이메일이 발송되지 않음

**증상:**
- 차단은 되지만 이메일 안옴

**원인:**
- mailutils 미설치
- Postfix 설정 오류
- 이메일 주소 오류

**해결:**
```bash
# mailutils 설치 확인
which mail

# 수동 테스트
echo "Test email" | mail -s "Test" info@codebase.blog

# Postfix 로그 확인
sudo tail -f /var/log/mail.log

# Fail2ban 액션 로그 확인
sudo grep "mail" /var/log/fail2ban.log
```

---

### 문제 4: 리포트 스크립트 실행 안됨

**증상:**
- Crontab에 등록했지만 이메일 안옴

**원인:**
- 스크립트 실행 권한 없음
- Crontab 경로 오류
- 환경 변수 문제

**해결:**
```bash
# 스크립트 권한 확인
ls -la /usr/local/bin/fail2ban-daily-report.sh

# 수동 실행 테스트
sudo /usr/local/bin/fail2ban-daily-report.sh

# Crontab 로그 확인
sudo tail -f /var/log/fail2ban-report.log

# Cron 데몬 확인
sudo systemctl status cron
```

---

### 문제 5: 좋은 봇이 차단됨

**증상:**
- Google Search Console에서 크롤링 오류 보고

**원인:**
- ignoreregex 패턴 오류
- User-Agent 위장 봇

**해결:**
```bash
# Googlebot 차단 확인
sudo grep "Googlebot" /var/log/fail2ban.log

# 해당 IP 차단 해제
sudo fail2ban-client unban Googlebot_IP

# Filter에 ignoreregex 추가 확인
sudo cat /etc/fail2ban/filter.d/nginx-excessive-crawling.conf | grep ignoreregex

# Googlebot IP 화이트리스트 추가 (선택)
# /etc/fail2ban/jail.local [DEFAULT]
ignoreip = 127.0.0.1/8 ::1 66.249.64.0/19  # Google
```

---

## 성능 모니터링

### 정상 작동 확인

```bash
# Jail별 통계 확인
for jail in $(sudo fail2ban-client status | grep "Jail list" | sed 's/.*://; s/,//g'); do
    echo "=== $jail ==="
    sudo fail2ban-client status "$jail" | grep -E "(Currently|Total)"
done

# 리소스 사용량
sudo systemctl status fail2ban | grep -E "(Memory|CPU)"

# 차단 효과 확인 (공격 감소)
sudo wc -l /var/log/nginx/access.log
```

### 월간 보고서 생성

```bash
# 한 달간 차단 통계
sudo grep "Ban " /var/log/fail2ban.log | \
  awk -v month="$(date +%Y-%m)" '$0 ~ month {print $7}' | \
  sort | uniq -c | sort -rn | head -20

# Jail별 차단 횟수
sudo grep "Ban " /var/log/fail2ban.log | \
  awk '{print $7}' | sort | uniq -c | sort -rn
```

---

## 참고 자료

### 공식 문서
- [Fail2ban Documentation](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [Nginx Documentation](https://nginx.org/en/docs/)

### 관련 파일
- [DEPLOYMENT_ORACLE.md](./DEPLOYMENT_ORACLE.md) - 서버 배포 가이드
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 개발 가이드

### 변경 이력
- 2025-10-28: 초기 보안 설정 완료
  - Nginx 민감 경로 차단
  - Fail2ban 7개 Jail 구성
  - 이메일 리포트 시스템 구축

---

## 문의

보안 관련 문의:
- 이메일: info@codebase.blog
- 일일 리포트: 매일 00:00 KST 자동 발송
