# Oracle Cloud로 무료 서버 만들기 - 실전 가이드

## 🚀 서론: 개발자라면 누구나 꿈꾸는 무료 서버

안녕하세요! 오늘은 정말 꿀팁을 하나 공유하려고 합니다. 바로 **Oracle Cloud Infrastructure(OCI)**를 이용해서 평생 무료로 서버를 운영하는 방법입니다.

> "AWS 프리티어는 1년이잖아요? Oracle Cloud는 진짜 평생 무료인가요?"

네, 맞습니다! Oracle Cloud의 Always Free 티어는 정말로 평생 무료입니다. 물론 몇 가지 제한사항이 있지만, 개인 프로젝트나 포트폴리오용으로는 충분합니다.

## 📚 핵심 용어 정리

서버를 만들기 전에 Oracle Cloud의 주요 용어들을 먼저 이해해봅시다:

### 1. **Tenancy (테넌시)**
- Oracle Cloud에서 최상위 관리 도메인
- 쉽게 말해 여러분의 "클라우드 집" 같은 개념
- 모든 리소스가 이 테넌시 안에 생성됨

### 2. **VM Instance (가상 머신 인스턴스)**
- 실제로 사용할 가상 서버
- EC2 인스턴스와 비슷한 개념
- CPU, 메모리, 스토리지를 할당받은 가상 컴퓨터

### 3. **OCPU vs vCPU**
- **OCPU**: Oracle CPU (물리적 CPU 코어에 대응)
- **vCPU**: Virtual CPU (하이퍼스레딩된 가상 CPU)
- 1 OCPU = 2 vCPU 정도로 이해하시면 됩니다

## 🛠️ 서버 생성 과정

### Step 1: Oracle Cloud 콘솔 접속
```bash
# 브라우저에서 접속
https://cloud.oracle.com
```

로그인 후 대시보드가 나타납니다. 처음엔 복잡해 보이지만 걱정 마세요!

### Step 2: VM 인스턴스 메뉴로 이동
1. 좌측 햄버거 메뉴(☰) 클릭
2. **Compute** → **Instances** 선택
3. **Create Instance** 버튼 클릭

### Step 3: 인스턴스 설정

#### 기본 정보 설정
```yaml
Name: my-free-server
Compartment: (root) # 기본값 사용
Placement: AD-1 # 가용 영역 선택
```

#### 이미지 및 Shape 선택
```yaml
Image: Ubuntu 24.04 LTS  # 추천!
Shape: VM.Standard.A1.Flex  # ARM 기반 무료 인스턴스
OCPU: 1
Memory: 6 GB
```

> 💡 **Pro Tip**: Ubuntu 24.04를 선택하는 이유
> - 최신 LTS 버전으로 5년간 보안 업데이트 지원
> - Docker, Kubernetes 등 최신 기술 호환성 우수
> - 풍부한 커뮤니티 지원

### Step 4: 네트워킹 설정

```yaml
Virtual Cloud Network: 자동 생성 선택
Subnet: Public Subnet (자동 생성)
Public IP: Assign a public IPv4 address # 중요!
```

### Step 5: SSH 키 추가

```bash
# 로컬에서 SSH 키 생성 (이미 있다면 스킵)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 공개 키 확인
cat ~/.ssh/id_rsa.pub
```

생성된 공개 키를 복사해서 Oracle Cloud 콘솔에 붙여넣기!

## ⚠️ 주의사항 및 트러블슈팅

### 문제 1: "Out of capacity" 에러
무료 리소스가 부족할 때 발생합니다. 해결 방법:
1. 다른 지역(Region) 선택
2. 다른 시간대에 재시도
3. Shape를 변경 (예: AMD 대신 ARM 선택)

### 문제 2: "Upgrade to Pay As You Go" 요구
무료 계정에는 일부 제한이 있습니다:
- 신용카드 등록 필요 (과금되지 않음)
- 업그레이드 후에도 Always Free 리소스는 무료

### 성공적인 생성 확인
```bash
# SSH로 접속 테스트
ssh ubuntu@<공개_IP_주소>

# 시스템 정보 확인
uname -a
free -h
df -h
```

## 🎯 다음 단계

서버 생성이 완료되었다면:

1. **보안 설정**
   - 방화벽 규칙 설정
   - fail2ban 설치
   - SSH 포트 변경

2. **기본 소프트웨어 설치**
```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 도구 설치
sudo apt install -y git vim htop nginx docker.io

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **도메인 연결 (선택사항)**
   - Cloudflare 무료 플랜 활용
   - Let's Encrypt SSL 인증서 설정

## 💭 마무리

Oracle Cloud의 무료 서버는 정말 훌륭한 학습 도구입니다. AWS나 GCP에 비해 인지도는 낮지만, 무료 리소스는 오히려 더 관대합니다.

**Oracle Cloud 무료 티어 스펙:**
- ARM 기반 VM 최대 4개 (총 4 OCPU, 24GB RAM)
- 200GB 블록 스토리지
- 10TB/월 아웃바운드 트래픽

이 정도면 개인 프로젝트 여러 개를 돌리고도 남습니다!

## 🔗 유용한 링크

- [Oracle Cloud Always Free 공식 문서](https://www.oracle.com/cloud/free/)
- [Ubuntu 24.04 LTS 릴리즈 노트](https://ubuntu.com/blog/ubuntu-24-04-lts)
- [OCI CLI 설치 가이드](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm)

---

> 💬 **질문이 있으신가요?**
>
> 서버 생성 과정에서 막히는 부분이 있다면 댓글로 남겨주세요. 제가 겪었던 시행착오를 바탕으로 도움을 드리겠습니다!

**태그:** #OracleCloud #무료서버 #클라우드 #Ubuntu #DevOps #인프라 #ServerSetup