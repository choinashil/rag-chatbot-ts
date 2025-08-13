# Stage 1: 세션 기반 모니터링 인프라 구축 - 설정 가이드

> **작성일**: 2025-08-13 13:00 KST  
> **목적**: Stage 1 개발을 위한 AWS RDS 및 LangSmith 환경 구축 가이드  
> **대상**: 개발팀, 인프라 담당자

## 개요

Stage 1에서는 세션 기반 채팅 관리와 하이브리드 모니터링 시스템을 구축합니다. 이를 위해 PostgreSQL 데이터베이스(AWS RDS)와 LangSmith 추적 시스템이 필요합니다.

## 필수 인프라 구성 요소

### 1. 🗄️ **PostgreSQL 데이터베이스 (AWS RDS)**
**역할**: 세션 관리, 메시지 저장, 비즈니스 메타데이터 추적

### 2. 📊 **LangSmith 모니터링**
**역할**: AI 모델 성능 추적, 응답 시간 모니터링, 자동 디버깅

---

## AWS RDS PostgreSQL 구축

### 구축 목적
- **세션 기반 대화 관리**: 사용자별 대화 맥락 유지
- **멀티 스토어 지원**: store_id별 과금 및 통계 관리
- **데이터 안정성**: 소프트 삭제, 트랜잭션 지원
- **확장성**: 향후 Redis 도입 시점 판단을 위한 성능 데이터 수집

### PostgreSQL vs Aurora 선택 근거

#### ✅ **PostgreSQL 선택 이유 (MVP 단계)**
```bash
# 비용 효율성
PostgreSQL (db.t3.micro): $0 (무료티어) → $15-20/월
Aurora PostgreSQL: $45-60/월 (최소 비용)

# 워크로드 적합성
- 간단한 CRUD 작업 (90% 단순 INSERT/SELECT)
- 월 수천~수만 세션 수준
- 복잡한 분석 쿼리 불필요
- 단일 지역 서비스

# 관리 복잡성
- 단일 인스턴스로 간단한 관리
- 백업/복구 정책 단순화
- 모니터링 오버헤드 최소화
```

#### 🔄 **Aurora 마이그레이션 시점**
다음 조건 중 하나라도 해당될 때 Aurora 고려:
- CPU 사용률 지속적 80% 이상
- 동시 연결 수 100개 근접
- 99.99% 가용성 SLA 요구사항
- 월 10만 세션 이상 처리
- 글로벌 사용자 지원 필요

#### 📋 **PostgreSQL 버전 선택 기준 (2025년 8월 기준)**
```bash
# 권장: PostgreSQL 15.13 ✅
- 검증된 안정성 (2년+ 프로덕션 운영)
- 풍부한 확장 라이브러리 지원 (pgvector, PostGIS 등)
- 커뮤니티 지원 및 문서 완비
- RAG/AI 워크로드에 최적화된 성능

# 고려 가능: PostgreSQL 17.5 (최신)
- 최신 성능 개선 기능
- 새로운 SQL 기능들
- 단점: 상대적으로 적은 운영 경험

# AWS RDS 지원 버전 (2025년)
PostgreSQL 17.5, 16.9, 15.13, 14.18, 13.21
```

### 방법 1: AWS CLI (참고용)

#### **개발 환경 CLI**
```bash
# 개발용 RDS 생성
aws rds create-db-instance \
  --db-instance-identifier sixshop-ai-agent-dev \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.13 \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type gp2 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --availability-zone ap-northeast-2a \
  --no-multi-az \
  --no-storage-encrypted \
  --publicly-accessible \
  --backup-retention-period 7 \
  --auto-minor-version-upgrade \
  --enable-cloudwatch-logs-exports postgresql \
  --no-deletion-protection \
  --tags Key=Project,Value=sixshop-ai-agent Key=Environment,Value=dev Key=Owner,Value=development-team
```

#### **운영 환경 CLI**
```bash
# 운영용 RDS 생성
aws rds create-db-instance \
  --db-instance-identifier sixshop-ai-agent-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.13 \
  --allocated-storage 100 \
  --max-allocated-storage 1000 \
  --storage-type gp2 \
  --master-username postgres \
  --master-user-password YOUR_PRODUCTION_SECURE_PASSWORD \
  --vpc-security-group-ids sg-yyyyyyyyyy \
  --availability-zone ap-northeast-2a \
  --multi-az \
  --storage-encrypted \
  --kms-key-id alias/aws/rds \
  --no-publicly-accessible \
  --backup-retention-period 30 \
  --auto-minor-version-upgrade \
  --enable-cloudwatch-logs-exports postgresql \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --monitoring-interval 60 \
  --monitoring-role-arn arn:aws:iam::ACCOUNT-ID:role/rds-monitoring-role \
  --deletion-protection \
  --tags Key=Project,Value=sixshop-ai-agent Key=Environment,Value=prod Key=Owner,Value=operations-team
```

### 방법 2: AWS 콘솔 (GUI) - 현재 페이지 순서 기준

#### **1. 데이터베이스 생성 방식 선택**
```bash
✅ 표준 생성 (권장)
- 모든 옵션 직접 제어 가능
- 비용 최적화 가능

❌ 손쉬운 생성
- AWS 기본값 사용 (비용 증가 가능성)
```

#### **2. 엔진 옵션**
```bash
✅ 엔진 유형: PostgreSQL
✅ 엔진 버전: PostgreSQL 15.13 (권장)
```

#### **3. 가용성 및 내구성**
```bash
# 개발 환경
✅ 단일 AZ DB 인스턴스 배포 (인스턴스 1개)
- 비용: 저렴
- 가용성: 99.9%

# 운영 환경
✅ 다중 AZ DB 인스턴스 배포 (인스턴스 2개)
- 비용: 2배
- 가용성: 99.99%
- 자동 장애 조치

❌ 다중 AZ DB 클러스터 배포 (인스턴스 3개)
- 비용: 3배 (과도함)
```

#### **4. 템플릿**
```bash
# 개발 환경
✅ 프리 티어
- 12개월 무료
- db.t3.micro 자동 선택

# 운영 환경
✅ 개발/테스트
- 유연한 인스턴스 선택 가능
- 적절한 기본값

❌ 프로덕션
- 불필요한 고사양 기본값
```

#### **5. 설정**
```bash
# 개발 환경
✅ DB 인스턴스 식별자: sixshop-ai-agent-dev

# 운영 환경
✅ DB 인스턴스 식별자: sixshop-ai-agent-prod

# 자격 증명 설정
✅ 마스터 사용자 이름: postgres (기본값 유지)

# 자격 증명 관리
✅ 자체 관리 (개발용)
- 간단한 암호 직접 입력

✅ AWS Secrets Manager에서 관리 (운영용, 선택적)
- 자동 암호 순환
- 추가 비용: $0.40/월

✅ 마스터 암호: 안전한 비밀번호 입력
```

#### **6. 인스턴스 구성**
```bash
# DB 인스턴스 클래스
✅ 버스터블 클래스 (권장)
- 일반적인 워크로드에 적합
- 비용 효율적

❌ 스탠다드 클래스: 고비용
❌ 메모리 최적화 클래스: 불필요

# 개발 환경
✅ db.t3.micro (2 vCPUs, 1GiB RAM)
- 무료 티어 → $15/월

# 운영 환경
✅ db.t3.small (2 vCPUs, 2GiB RAM)
- $30/월
- 더 나은 성능
```

#### **7. 스토리지**
```bash
✅ 스토리지 유형: 범용 SSD(gp2)
- 비용 효율적
- 적절한 성능 (3 IOPS/GB)

❌ 프로비저닝된 IOPS: 고비용

# 개발 환경
✅ 할당된 스토리지: 20GiB

# 운영 환경
✅ 할당된 스토리지: 100GiB

# 추가 스토리지 구성
✅ 스토리지 자동 조정 활성화: ON
✅ 최대 스토리지 임계값: 
   - 개발: 100GiB
   - 운영: 1000GiB
```

#### **8. 연결**
```bash
✅ 컴퓨팅 리소스: EC2 컴퓨팅 리소스에 연결 안 함
✅ 네트워크 유형: IPv4
✅ VPC: Default VPC (vpc-xxxxxxxx)
✅ DB 서브넷 그룹: 기본값

# 퍼블릭 액세스
✅ 개발 환경: Yes (로컬 접근 필요)
✅ 운영 환경: No (보안상 필수)

# VPC 보안 그룹(방화벽)
✅ 새로 생성 선택

# 새 VPC 보안 그룹 이름
✅ 개발: sixshop-ai-agent-dev-sg
✅ 운영: sixshop-ai-agent-prod-sg
# -sg = Security Group (AWS 네이밍 컨벤션)

✅ RDS 프록시: 생성 안 함
- 추가 비용 $11/월
- 현재 불필요 (PostgreSQL 기본 풀 충분)

✅ 인증 기관: rds-ca-rsa2048-g1 (기본값 유지)
✅ 데이터베이스 포트: 5432 (기본값 유지)
```

#### **9. 데이터베이스 인증**
```bash
✅ 데이터베이스 인증 옵션: 암호 인증
- 간단하고 안전

❌ IAM 데이터베이스 인증: 복잡함
❌ Kerberos 인증: 기업용, 불필요
```

#### **10. 모니터링**
```bash
# Database Insights
✅ 개발 환경: 표준 (무료)
✅ 운영 환경: 고급 (권장)
   - 성능 분석 도구
   - 비용: $30/월

# 추가 모니터링 설정
✅ 개발: 향상된 모니터링 활성화 OFF (비용 절약)
✅ 운영: 향상된 모니터링 활성화 ON
   - 모니터링 간격: 60초
   - 비용: $2.50/월
```

#### **11. 추가 구성** ⭐
```bash
# 초기 데이터베이스 이름 (선택적)
✅ 개발: rag_chatbot_dev
✅ 운영: rag_chatbot_prod

# 데이터베이스 옵션
✅ 기본값 유지

# 암호화 (중요!)
✅ 개발: 암호화 안 함 (비용 절약)
✅ 운영: 암호화 활성화
   - KMS 키: 기본값 (aws/rds)

# 로그 내보내기 (권장)
✅ PostgreSQL log 활성화
❌ Upgrade log (불필요)
- CloudWatch로 전송되어 모니터링 가능

# 삭제 방지
✅ 개발: 삭제 방지 비활성화
✅ 운영: 삭제 방지 활성화 (필수)
```

#### **12. 백업**
```bash
✅ 자동 백업 활성화: Yes

# 백업 보존 기간
✅ 개발: 7일
✅ 운영: 30일 (규정 준수)

✅ 백업 기간: No preference (AWS 최적 시간 자동 선택)
✅ 스냅샷으로 태그 복사: Yes
```

#### **13. 유지 관리**
```bash
✅ 마이너 버전 자동 업그레이드 사용: Yes
- 보안 패치 자동 적용

✅ 유지 관리 기간: No preference
- AWS가 최적 시간 자동 선택
```

#### **14. 태그 설정** ⭐
```bash
# 비용 관리 및 리소스 추적을 위한 필수 태그
✅ Project: sixshop-ai-agent
✅ Environment: dev (또는 prod)
✅ Owner: development-team (또는 operations-team)
✅ Application: rag-chatbot
✅ CostCenter: ai-development
```

## 📋 **설정 요약 체크리스트**

### **개발 환경 (sixshop-ai-agent-dev)**
```bash
✅ 표준 생성 → PostgreSQL 15.13 → 프리 티어
✅ 단일 AZ → db.t3.micro → 20GiB gp2
✅ 퍼블릭 액세스: Yes → 새 보안 그룹
✅ 암호 인증 → 자체 관리 → 암호화 안 함
✅ 표준 모니터링 → 향상된 모니터링 OFF
✅ 백업 7일 → 자동 업그레이드 ON → 삭제 방지 OFF
✅ PostgreSQL 로그 내보내기 → 적절한 태그 설정

예상 비용: 무료 (12개월) → $15-20/월
```

### **운영 환경 (sixshop-ai-agent-prod)**
```bash
✅ 표준 생성 → PostgreSQL 15.13 → 개발/테스트
✅ 다중 AZ → db.t3.small → 100GiB gp2
✅ 퍼블릭 액세스: No → 새 보안 그룹
✅ 암호 인증 → Secrets Manager → 암호화 활성화
✅ 고급 모니터링 → 향상된 모니터링 ON (60초)
✅ 백업 30일 → 자동 업그레이드 ON → 삭제 방지 ON
✅ PostgreSQL 로그 내보내기 → 적절한 태그 설정

예상 비용: $60-80/월 (다중 AZ + 고급 모니터링)
```

### 보안 그룹 설정
```bash
# PostgreSQL 포트 5432 허용
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0  # 개발용만, 프로덕션에서는 특정 IP로 제한
```

### 연결 테스트
```bash
# RDS 생성 완료 후 연결 테스트
psql -h your-rds-endpoint.amazonaws.com -U postgres -d postgres
```

---

## LangSmith 설정

### 설정 목적
- **AI 모델 성능 추적**: 응답 시간, 토큰 사용량, 에러율 자동 수집
- **디버깅 지원**: 실패한 요청의 상세 추적 및 분석
- **A/B 테스트**: 프롬프트 변경 시 성능 비교
- **비용 최적화**: 토큰 사용 패턴 분석으로 비용 절감 기회 발견

### 1. LangSmith 계정 생성
1. [LangSmith 웹사이트](https://smith.langchain.com) 접속
2. 계정 생성 또는 로그인
3. 조직(Organization) 생성 (예: `rag-chatbot-company`)

### 2. 프로젝트 생성
1. **New Project** 클릭
2. **프로젝트 설정**:
   - Name: `rag-chatbot-dev`
   - Description: `RAG 챗봇 개발 환경 모니터링`
   - Visibility: `Private`

### 3. API 키 생성

#### 키 타입 선택: **Service Key** ✅

**Service Key를 선택하는 이유:**
- **Personal Access Token**: 개인 사용자 계정용, 사용자 인증 기반
- **Service Key**: 애플리케이션/서비스용, 서비스 인증 기반
- RAG 챗봇은 **서비스**이므로 Service Key가 적합

#### 키 생성 과정
1. **Settings** → **API Keys** 이동
2. **Create API Key** 클릭
3. **키 설정**:
   ```bash
   Key Type: Service Key
   Name: rag-chatbot-dev-service
   Description: RAG 챗봇 개발 환경용 서비스 키
   Expiration: No expiration (개발용) 또는 1년 (프로덕션용)
   ```

4. **권한 설정** (필수):
   ```bash
   ✅ Read projects    # 프로젝트 정보 조회
   ✅ Write runs       # AI 실행 기록 저장
   ✅ Read runs        # 실행 기록 조회
   ✅ Write feedback   # 사용자 피드백 저장
   ✅ Read feedback    # 피드백 조회
   ```

5. **키 복사 및 보관**:
   - 생성된 키는 `lsv2_pt_` 또는 `lsv2_sk_`로 시작
   - 안전한 곳에 즉시 복사 (재확인 불가)

#### 만료 기간 권장사항
```bash
# 개발 환경
Expiration: No expiration
이유: 개발 중 키 만료로 인한 중단 방지

# 프로덕션 환경  
Expiration: 1년
이유: 보안상 주기적 키 갱신 권장
```

### 4. 환경변수 설정
```bash
# env/.env.dev 파일에 추가
LANGSMITH_API_KEY=lsv2_sk_xxxxxxxxxxxxxxxxx
LANGSMITH_PROJECT_NAME=rag-chatbot-dev
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

### 5. 연결 테스트
```typescript
// 간단한 연결 테스트
import { LangSmith } from 'langsmith'

const client = new LangSmith({
  apiKey: process.env.LANGSMITH_API_KEY
})

// 프로젝트 존재 확인
await client.readProject({ projectName: 'rag-chatbot-dev' })
```

---

## 환경변수 설정

### 1. 개발 환경 파일 생성
```bash
# 템플릿 복사
cp env/.env.example env/.env.dev
```

### 2. env/.env.dev 수정
```bash
# =================================
# 서버 설정
# =================================
PORT=8000
NODE_ENV=development

# =================================
# PostgreSQL 데이터베이스 설정
# =================================
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=rag_chatbot_dev
DB_USER=postgres
DB_PASSWORD=your_secure_password

# 연결 풀 설정
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# =================================
# LangSmith 설정
# =================================
LANGSMITH_API_KEY=lsv2_sk_xxxxxxxxxxxxxxxxx
LANGSMITH_PROJECT_NAME=rag-chatbot-dev
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# =================================
# 세션 관리 설정
# =================================
SESSION_EXPIRE_HOURS=24
SESSION_CLEANUP_INTERVAL_MINUTES=60
HARD_DELETE_AFTER_DAYS=90

# =================================
# 기존 API 설정 (그대로 유지)
# =================================
NOTION_INTEGRATION_TOKEN=your_existing_token
NOTION_DATABASE_ID=your_existing_database_id
OPENAI_API_KEY=your_existing_openai_key
PINECONE_API_KEY=your_existing_pinecone_key
PINECONE_INDEX_NAME=rag-chatbot
```

---

## 데이터베이스 초기화

### 1. 스키마 생성
```bash
# PostgreSQL 클라이언트로 초기화 스크립트 실행
psql -h your-rds-endpoint.amazonaws.com -U postgres -d rag_chatbot_dev -f scripts/init-database.sql
```

### 2. 연결 확인
```bash
# 테이블 생성 확인
psql -h your-rds-endpoint.amazonaws.com -U postgres -d rag_chatbot_dev -c "\dt"

# 샘플 데이터 확인
psql -h your-rds-endpoint.amazonaws.com -U postgres -d rag_chatbot_dev -c "SELECT 'Database ready!' as status;"
```

---

## 설정 완료 체크리스트

### ✅ **AWS RDS PostgreSQL** (완료: 2025-08-13)
- [x] RDS 인스턴스 생성 완료 (sixshop-ai-agent.c50k48eq6zr3.ap-northeast-2.rds.amazonaws.com)
- [x] 보안 그룹에서 포트 5432 허용
- [x] 연결 테스트 성공 (PostgreSQL 15.x)
- [x] 초기화 스크립트 실행 완료 (chat_sessions, chat_messages 테이블 생성)

### ✅ **LangSmith** (완료: 2025-08-13)
- [x] 계정 및 조직 생성
- [x] 프로젝트 `sixshop-ai-agent` 생성
- [x] Service Key 생성 (적절한 권한 설정)
- [x] API 키 안전하게 보관 및 설정

### ✅ **환경변수** (완료: 2025-08-13)
- [x] `env/.env.dev` 파일 생성 및 설정
- [x] PostgreSQL 연결 정보 입력 (실제 RDS 엔드포인트 적용)
- [x] LangSmith API 키 입력
- [x] 기존 API 키들 유지 (OpenAI, Pinecone 등)

### ✅ **연결 테스트** (완료: 2025-08-13)
- [x] PostgreSQL 연결 성공 (하이브리드 추적 서비스 정상 동작)
- [x] LangSmith API 호출 성공 (RAG 메트릭 추적 확인)
- [x] 모든 테이블 생성 확인 (스키마, 인덱스, 트리거, 함수 포함)

---

## 보안 고려사항

### 🔒 **API 키 관리**
- env/.env.dev 파일은 절대 git에 커밋하지 않음
- 팀 공유 시 안전한 채널 사용 (Slack DM, 암호화된 파일)
- 정기적인 키 갱신 (프로덕션 환경)

### 🔒 **데이터베이스 보안**
- 개발용은 public access 허용하지만 프로덕션에서는 VPC 내부만
- 강력한 마스터 비밀번호 사용
- 정기적인 백업 확인

### 🔒 **네트워크 보안**
- 개발 환경: 0.0.0.0/0 허용 (편의성)
- 프로덕션 환경: 특정 IP 대역만 허용

---

## 문제 해결

### PostgreSQL 연결 실패
```bash
# 보안 그룹 확인
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# RDS 상태 확인
aws rds describe-db-instances --db-instance-identifier rag-chatbot-dev
```

### LangSmith API 오류
```bash
# API 키 유효성 확인
curl -H "Authorization: Bearer $LANGSMITH_API_KEY" \
  https://api.smith.langchain.com/projects
```

### 환경변수 로딩 실패
```typescript
// 환경변수 확인 코드
console.log({
  dbHost: process.env.DB_HOST,
  langsmithKey: process.env.LANGSMITH_API_KEY ? '✅ 설정됨' : '❌ 미설정'
})
```

---

## Stage 1 완료 상태 (2025-08-13)

### 🎉 **인프라 구축 완료**
모든 필수 인프라가 성공적으로 구축 및 검증되었습니다:

1. **PostgreSQL Database**: `sixshop-ai-agent.c50k48eq6zr3.ap-northeast-2.rds.amazonaws.com`
   - 세션 관리 테이블 (chat_sessions, chat_messages) 생성 완료
   - 트리거 및 저장 함수 정상 동작 확인
   - 하이브리드 추적 서비스 연동 성공

2. **LangSmith Monitoring**: 프로젝트 `sixshop-ai-agent`
   - RAG 메트릭 추적 시스템 활성화
   - 응답 시간, 토큰 사용량, 만족도 점수 수집 중

3. **세션 기반 API**: `/api/session-chat/*`
   - 세션 생성, 조회, 채팅, 통계 API 구현 완료
   - REST 및 SSE 스트리밍 모두 지원
   - 통합 테스트 7개 모두 통과

### 📊 **검증 완료 지표**
```bash
✅ 데이터베이스 연결: 성공 (35ms 응답)
✅ 세션 생성: 201 응답 (30ms)
✅ 채팅 기능: 200 응답 (4.3초, OpenAI 포함)
✅ LangSmith 추적: 정상 동작
✅ 데이터 일관성: PostgreSQL + LangSmith 동기화
```

## 다음 단계

### ✅ **완료된 작업** 
- [x] AWS RDS PostgreSQL 구축 및 연결
- [x] LangSmith 모니터링 시스템 구축  
- [x] 세션 기반 API 구현 및 테스트
- [x] 하이브리드 데이터 저장 시스템 구현
- [x] 통합 테스트 및 검증 완료

### 🔄 **아키텍처 개선사항 반영 (2025-08-13)**
**변경 내용**: HybridTrackingService를 단일 책임 원칙에 따라 분리
- ✅ `SessionService`: 세션 CRUD 및 생명주기 관리
- ✅ `ChatAnalyticsService`: 메시지 통계, 성능 메트릭, 비즈니스 분석  
- ✅ `LLMMonitoringService`: LangSmith 연동 및 AI 워크플로우 추적
- ✅ `IntegratedChatService`: 위 3개 서비스를 조합한 통합 인터페이스

**추가 개선사항**:
- ✅ OpenAI API 응답에서 실제 토큰 사용량 추출 (tiktoken보다 정확)
- ✅ MVP 단계에 불필요한 `session_context`, `privacy_level` 필드 제거
- ✅ 매직 넘버들을 상수로 분리 (`SESSION_CONSTANTS`)
- ✅ 타입 정의를 `types/session-chat.ts`로 분리
- ✅ 데이터베이스 `application_name`을 `sixshop-ai-agent`로 변경

### 🚀 **다음 개발 단계 (Stage 2)**
1. **인증/인가 시스템** 구현
2. **관리자 대시보드** 개발
3. **실시간 알림** 시스템 구축  
4. **성능 모니터링** 강화
5. **자동 배포** 파이프라인 구성

---

**작성일**: 2025-08-13 13:00 KST  
**최종 업데이트**: 2025-08-13 15:40 KST (Stage 1 완료)  
**작성자**: Development Team  
**상태**: ✅ **완료** - Stage 1 인프라 구축 및 세션 기반 API 개발 완료