# Notion 연동 설정 및 테스트 가이드

## 1. Notion Integration 생성

1. **Notion Integrations 페이지 접속**
   - https://www.notion.so/my-integrations 방문
   
2. **새 Integration 생성**
   - "New integration" 버튼 클릭
   - Name: `RAG Chatbot Integration` 
   - Associated workspace: 사용할 워크스페이스 선택
   - Submit 클릭

3. **Integration Token 복사**
   - 생성된 Integration 페이지에서 "Internal Integration Token" 복사
   - 형식: `secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

## 2. Database 공유 설정

1. **테스트용 Database 선택**
   - 기존 Database 사용 또는 새 Database 생성
   
2. **Integration에 Database 공유**
   - Database 페이지 우상단 "..." 클릭
   - "Add connections" 선택
   - 생성한 Integration 선택하여 추가

3. **Database ID 복사**
   - Database URL에서 ID 부분 복사
   - URL 형식: `https://notion.so/workspace/DATABASE_ID?v=...`
   - DATABASE_ID 부분만 복사 (32자리 문자열)

## 3. 환경변수 설정

1. **`env/.env.dev` 파일 생성 또는 편집**
   ```bash
   # env/.env.dev 파일 생성/편집
   ```

2. **환경변수 입력**
   ```bash
   # env/.env.dev 파일에 추가
   NOTION_INTEGRATION_TOKEN=secret_your_copied_token_here
   NOTION_DATABASE_ID=your_copied_database_id_here
   ```

## 4. 연동 테스트 실행

```bash
# Notion API 연동 테스트
npm run test:notion
```

## 예상 출력 결과

### 성공 시:
```
🔍 Notion API 연동 테스트 시작...

1. 환경변수 확인:
   ✅ NOTION_INTEGRATION_TOKEN: 설정됨
   ✅ NOTION_DATABASE_ID: 설정됨

2. NotionService 초기화...
   ✅ 초기화 성공!

3. 연결 상태 확인:
   연결 상태: ✅ 연결됨
   마지막 확인: 2025-01-07T12:00:00.000Z
   데이터베이스 ID: abc123...

4. 페이지 목록 조회 (최대 5개):
   📚 총 3개 페이지 발견:
   1. "테스트 페이지 1"
      ID: page-id-1
      URL: https://notion.so/page-id-1
      생성일: 2025/1/1
      수정일: 2025/1/2

   2. "테스트 페이지 2"
      ...

5. 첫 번째 페이지 상세 조회:
   "테스트 페이지 1" 상세 내용 조회 중...
   제목: 테스트 페이지 1
   내용 길이: 150 문자
   내용 미리보기:
   # 제목
   
   이것은 테스트 내용입니다...

🎉 Notion API 연동 테스트 완료!
```

### 실패 시 해결 방법:
- **API 연결 실패**: Integration Token 확인, 권한 확인
- **Database 조회 실패**: Database ID 확인, 공유 설정 확인
- **권한 부족**: Database에 Integration 추가했는지 확인

## 5. 문제 해결

### Integration Token 관련:
- Token이 `secret_`으로 시작하는지 확인
- Token 복사 시 공백이나 줄바꿈 없는지 확인

### Database ID 관련:
- ID가 32자리 영숫자 조합인지 확인 (하이픈 없음)
- Database URL에서 올바른 부분을 복사했는지 확인

### 권한 관련:
- Database "..." → "Add connections"에서 Integration 추가 확인
- Integration이 Database에 접근 권한을 갖고 있는지 확인