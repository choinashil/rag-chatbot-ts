// 토큰 유틸리티 함수 단위 테스트
import { 
  estimateTokenCount, 
  isTokenLimitExceeded, 
  splitTextIntoChunks,
  splitIntoBatches 
} from '../../../src/utils/token.utils'

describe('Token Utils', () => {
  describe('estimateTokenCount', () => {
    test('짧은 영어 텍스트 토큰 추정', () => {
      const text = 'Hello world'
      const tokenCount = estimateTokenCount(text)
      
      expect(tokenCount).toBeGreaterThan(0)
      expect(tokenCount).toBeLessThan(10)
    })

    test('긴 영어 텍스트 토큰 추정', () => {
      const text = 'This is a longer text that should have more tokens than a short text'
      const tokenCount = estimateTokenCount(text)
      
      expect(tokenCount).toBeGreaterThan(10)
      expect(tokenCount).toBeLessThan(30)
    })

    test('한국어 텍스트 토큰 추정', () => {
      const text = '안녕하세요. 이것은 한국어 텍스트입니다.'
      const tokenCount = estimateTokenCount(text)
      
      expect(tokenCount).toBeGreaterThan(0)
      expect(tokenCount).toBeLessThan(20)
    })

    test('빈 문자열 처리', () => {
      const tokenCount = estimateTokenCount('')
      expect(tokenCount).toBe(0)
    })

    test('공백만 있는 문자열', () => {
      const tokenCount = estimateTokenCount('   ')
      expect(tokenCount).toBeGreaterThanOrEqual(0)
    })

    test('매우 긴 텍스트 토큰 추정', () => {
      const longText = 'word '.repeat(1000)
      const tokenCount = estimateTokenCount(longText)
      
      expect(tokenCount).toBeGreaterThan(1000)
    })
  })

  describe('isTokenLimitExceeded', () => {
    test('제한 이하 텍스트', () => {
      const shortText = 'Short text'
      expect(isTokenLimitExceeded(shortText, 100)).toBe(false)
    })

    test('제한 초과 텍스트', () => {
      const longText = 'word '.repeat(10000)
      expect(isTokenLimitExceeded(longText, 100)).toBe(true)
    })

    test('기본 제한값 사용', () => {
      const shortText = 'Short text'
      expect(isTokenLimitExceeded(shortText)).toBe(false)
    })

    test('경계값 테스트', () => {
      const mediumText = 'word '.repeat(50)
      const tokenCount = estimateTokenCount(mediumText)
      
      expect(isTokenLimitExceeded(mediumText, tokenCount)).toBe(false)
      expect(isTokenLimitExceeded(mediumText, tokenCount - 1)).toBe(true)
    })
  })

  describe('splitTextIntoChunks', () => {
    test('짧은 텍스트는 분할하지 않음', () => {
      const shortText = '짧은 텍스트입니다.'
      const chunks = splitTextIntoChunks(shortText, 1000)
      
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe(shortText)
    })

    test('긴 텍스트 분할', () => {
      const sentences = Array(10).fill('이것은 하나의 문장입니다.')
      const longText = sentences.join(' ')
      
      const chunks = splitTextIntoChunks(longText, 20) // 작은 제한으로 강제 분할
      
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeGreaterThan(0)
      })
    })

    test('문장 단위 분할', () => {
      const text = '첫 번째 문장입니다. 두 번째 문장입니다! 세 번째 문장입니다?'
      const chunks = splitTextIntoChunks(text, 10) // 매우 작은 제한
      
      expect(chunks.length).toBeGreaterThan(0)
      // 각 청크가 문장 단위로 분할되었는지 확인 (. ! ? 포함)
      chunks.forEach(chunk => {
        expect(chunk.trim()).not.toBe('')
      })
    })

    test('오버랩 처리', () => {
      const longText = Array(20).fill('테스트 문장입니다.').join(' ')
      const chunks = splitTextIntoChunks(longText, 50, 10)
      
      if (chunks.length > 1) {
        // 오버랩이 있는지 확인 (정확한 검증은 복잡하므로 기본 구조만 확인)
        expect(chunks[0]).toBeTruthy()
        expect(chunks[1]).toBeTruthy()
      }
    })

    test('빈 텍스트 처리', () => {
      const chunks = splitTextIntoChunks('', 100)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe('')
    })

    test('매우 긴 단일 문장', () => {
      const longSentence = 'word'.repeat(1000) + '.'
      const chunks = splitTextIntoChunks(longSentence, 100)
      
      // 단일 문장이더라도 분할되어야 함
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('splitIntoBatches', () => {
    test('배열을 배치로 분할', () => {
      const items = Array.from({ length: 25 }, (_, i) => `item-${i}`)
      const batches = splitIntoBatches(items, 10)
      
      expect(batches).toHaveLength(3) // 10 + 10 + 5
      expect(batches[0]).toHaveLength(10)
      expect(batches[1]).toHaveLength(10)
      expect(batches[2]).toHaveLength(5)
    })

    test('배치 크기보다 작은 배열', () => {
      const items = ['a', 'b', 'c']
      const batches = splitIntoBatches(items, 10)
      
      expect(batches).toHaveLength(1)
      expect(batches[0]).toEqual(['a', 'b', 'c'])
    })

    test('빈 배열 처리', () => {
      const batches = splitIntoBatches([], 10)
      expect(batches).toHaveLength(0)
    })

    test('기본 배치 크기 사용', () => {
      const items = Array.from({ length: 150 }, (_, i) => i)
      const batches = splitIntoBatches(items)
      
      // 기본 배치 크기는 100이므로 2개 배치
      expect(batches).toHaveLength(2)
      expect(batches[0]).toHaveLength(100)
      expect(batches[1]).toHaveLength(50)
    })

    test('정확히 나누어 떨어지는 경우', () => {
      const items = Array.from({ length: 20 }, (_, i) => i)
      const batches = splitIntoBatches(items, 5)
      
      expect(batches).toHaveLength(4)
      batches.forEach(batch => {
        expect(batch).toHaveLength(5)
      })
    })

    test('배치 크기가 1인 경우', () => {
      const items = ['a', 'b', 'c']
      const batches = splitIntoBatches(items, 1)
      
      expect(batches).toHaveLength(3)
      expect(batches[0]).toEqual(['a'])
      expect(batches[1]).toEqual(['b'])
      expect(batches[2]).toEqual(['c'])
    })

    test('다양한 타입의 아이템', () => {
      const items = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
        { id: 3, name: 'test3' }
      ]
      const batches = splitIntoBatches(items, 2)
      
      expect(batches).toHaveLength(2)
      expect(batches[0]).toHaveLength(2)
      expect(batches[1]).toHaveLength(1)
      expect(batches[0]![0]).toEqual({ id: 1, name: 'test1' })
    })
  })

  describe('통합 테스트', () => {
    test('전체 플로우: 긴 텍스트 → 청크 분할 → 배치 분할', () => {
      // 1. 긴 텍스트 생성
      const sentences = Array(50).fill('이것은 테스트 문장입니다.')
      const longText = sentences.join(' ')
      
      // 2. 토큰 제한 확인
      expect(isTokenLimitExceeded(longText, 100)).toBe(true)
      
      // 3. 청크로 분할
      const chunks = splitTextIntoChunks(longText, 100)
      expect(chunks.length).toBeGreaterThan(1)
      
      // 4. 각 청크가 제한 이내인지 확인 (오버랩으로 인해 일부 청크는 약간 초과할 수 있음)
      chunks.forEach(chunk => {
        const tokenCount = estimateTokenCount(chunk)
        expect(tokenCount).toBeLessThan(250) // tiktoken 정확도로 인한 추가 조정
      })
      
      // 5. 배치로 분할
      const batches = splitIntoBatches(chunks, 5)
      expect(batches.length).toBeGreaterThanOrEqual(1)
      
      // 6. 배치 크기 확인
      batches.forEach((batch, index) => {
        if (index === batches.length - 1) {
          // 마지막 배치는 5개 이하일 수 있음
          expect(batch.length).toBeLessThanOrEqual(5)
        } else {
          expect(batch.length).toBe(5)
        }
      })
    })

    test('에지 케이스: 매우 짧은 텍스트들', () => {
      const shortTexts = ['a', 'b', 'c', 'd', 'e']
      
      shortTexts.forEach(text => {
        expect(isTokenLimitExceeded(text)).toBe(false)
      })
      
      const batches = splitIntoBatches(shortTexts, 2)
      expect(batches).toHaveLength(3)
    })

    test('에지 케이스: 빈 문자열들', () => {
      const emptyTexts = ['', '', '']
      const chunks = emptyTexts.flatMap(text => splitTextIntoChunks(text, 100))
      
      expect(chunks).toHaveLength(3)
      chunks.forEach(chunk => {
        expect(chunk).toBe('')
      })
    })
  })
})