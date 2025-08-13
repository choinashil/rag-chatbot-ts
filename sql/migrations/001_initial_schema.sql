-- RAG Chatbot PostgreSQL Database 초기화 스크립트
-- 멀티 스토어 권한 기반 세션 관리 + 데이터 품질 강화

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- chat_sessions 테이블 (멀티 스토어 권한 기반 세션 관리)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 글로벌 고유 식별자
    store_id VARCHAR(255) NOT NULL,                         -- 스토어 식별자 (과금/통계 단위)
    user_id VARCHAR(255) NOT NULL,                          -- 사용자 식별자 (프라이버시 단위)
    created_at TIMESTAMP DEFAULT NOW(),                      -- 세션 시작 시간
    last_active_at TIMESTAMP DEFAULT NOW(),                  -- 마지막 활동 시간
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'), -- 만료 시간
    metadata JSONB DEFAULT '{}',                            -- 확장 가능한 커스텀 데이터
    is_active BOOLEAN DEFAULT true,                         -- 활성화 상태
    
    -- 데이터 안정성 강화 필드
    deleted_at TIMESTAMP                                    -- 소프트 삭제 (실수 복구 + 감사 목적)
    
    -- 향후 확장용 필드 (MVP에서는 제거)
    -- session_context JSONB DEFAULT '{}',                    -- 스토어별 컨텍스트
    -- privacy_level VARCHAR(20) DEFAULT 'private'            -- 'private', 'team', 'store'
);

-- chat_messages 테이블 (개별 메시지 + 데이터 품질 강화)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- 메시지 고유 식별자
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE, -- 세션 연결
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')), -- 메시지 주체
    content TEXT NOT NULL,                                  -- 메시지 내용
    token_count INTEGER,                                    -- 토큰 사용량 추적
    response_time_ms INTEGER,                               -- 응답 시간
    metadata JSONB DEFAULT '{}',                           -- 메시지별 확장 데이터
    langsmith_trace_id VARCHAR(255),                       -- LangSmith 연동 ID
    parent_message_id UUID REFERENCES chat_messages(id),   -- 메시지 체인
    created_at TIMESTAMP DEFAULT NOW(),                     -- 메시지 생성 시간
    
    -- 데이터 품질 및 안정성 강화 필드
    sequence_number INTEGER NOT NULL,                       -- 메시지 순서 보장 (동시성 처리 + 세션 복원)
    is_deleted BOOLEAN DEFAULT false,                       -- 소프트 삭제 (실수 복구 + 감사 목적)
    deleted_at TIMESTAMP                                    -- 삭제 시간 (데이터 보관 정책용, 선택적)
);

-- 성능 최적화 인덱스 (멀티 스토어 권한 + 데이터 품질)
-- 세션 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_active ON chat_sessions(expires_at, is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_store ON chat_sessions(store_id, created_at);     -- 스토어별 세션 조회
CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id, created_at);       -- 사용자별 개인 데이터
CREATE INDEX IF NOT EXISTS idx_sessions_store_user ON chat_sessions(store_id, user_id);   -- 교차 분석
-- CREATE INDEX IF NOT EXISTS idx_sessions_privacy ON chat_sessions(user_id, privacy_level); -- 프라이버시 필터링 (MVP에서 제거)

-- 메시지 관련 인덱스 (순서 보장 + 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON chat_messages(session_id, sequence_number); -- 메시지 순서 조회
CREATE INDEX IF NOT EXISTS idx_messages_session_time ON chat_messages(session_id, created_at);     -- 시간순 조회 (기존 호환)
CREATE INDEX IF NOT EXISTS idx_messages_langsmith ON chat_messages(langsmith_trace_id);            -- LangSmith 연동
CREATE INDEX IF NOT EXISTS idx_messages_active ON chat_messages(session_id, is_deleted);           -- 소프트 삭제 필터링

-- 시퀀스 생성 함수 (동시성 처리를 위한 sequence_number 자동 생성)
CREATE OR REPLACE FUNCTION get_next_message_sequence(session_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    -- 원자적으로 다음 sequence_number 생성
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
    FROM chat_messages 
    WHERE session_id = session_uuid;
    
    RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- 메시지 삽입 시 자동으로 sequence_number 설정하는 트리거
CREATE OR REPLACE FUNCTION set_message_sequence()
RETURNS TRIGGER AS $$
BEGIN
    -- sequence_number가 명시되지 않은 경우에만 자동 설정
    IF NEW.sequence_number IS NULL THEN
        NEW.sequence_number := get_next_message_sequence(NEW.session_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_message_sequence ON chat_messages;
CREATE TRIGGER trigger_set_message_sequence
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_message_sequence();

-- 세션 정리를 위한 함수 (만료된 세션 소프트 삭제)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- 만료된 세션을 비활성화 (소프트 삭제)
    UPDATE chat_sessions 
    SET is_active = false,
        deleted_at = NOW()
    WHERE expires_at < NOW() 
        AND is_active = true 
        AND deleted_at IS NULL;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 완전 삭제 함수 (90일 후 실제 데이터 삭제)
CREATE OR REPLACE FUNCTION hard_delete_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 90일 이상 지난 소프트 삭제 데이터 완전 삭제
    DELETE FROM chat_sessions 
    WHERE deleted_at IS NOT NULL 
        AND deleted_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 통계 조회용 뷰 (성능 최적화된 집계 데이터)
CREATE OR REPLACE VIEW session_stats AS
SELECT 
    s.store_id,
    s.user_id,
    DATE_TRUNC('day', s.created_at) as date,
    COUNT(*) as session_count,
    SUM(CASE WHEN s.is_active THEN 1 ELSE 0 END) as active_sessions,
    AVG(EXTRACT(EPOCH FROM (s.last_active_at - s.created_at))) as avg_duration_seconds,
    
    -- 메시지 통계
    COUNT(m.id) as total_messages,
    SUM(m.token_count) as total_tokens,
    AVG(m.response_time_ms) as avg_response_time_ms
FROM chat_sessions s
LEFT JOIN chat_messages m ON s.id = m.session_id AND m.is_deleted = false
WHERE s.deleted_at IS NULL
GROUP BY s.store_id, s.user_id, DATE_TRUNC('day', s.created_at);

-- 샘플 데이터 (개발용, 필요시 주석 해제)
/*
INSERT INTO chat_sessions (store_id, user_id, metadata) VALUES 
('store_demo', 'user_demo', '{"demo": true}');

INSERT INTO chat_messages (session_id, role, content, token_count, sequence_number) 
SELECT id, 'user', '안녕하세요! 테스트 메시지입니다.', 10, 1 
FROM chat_sessions WHERE store_id = 'store_demo' LIMIT 1;
*/

-- 초기화 완료 로그
SELECT 'RAG Chatbot PostgreSQL 데이터베이스 초기화 완료!' as status;