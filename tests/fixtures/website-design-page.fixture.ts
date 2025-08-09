/**
 * 웹사이트 디자인 페이지 (e7b780d5b6554f4e8bc957dcfcebfab3) 테스트 픽스처
 * 
 * 목적: '웹사이트 디자인' 페이지 패턴에 최적화된 벡터화 작업의 유닛테스트용
 * 용도: 다른 페이지 패턴 적용 시 현재 페이지 처리가 변경되지 않았는지 회귀 테스트
 */

export const WEBSITE_DESIGN_PAGE_ID = 'e7b780d5b6554f4e8bc957dcfcebfab3'

/**
 * 페이지 기본 정보 (pages.retrieve 응답 모킹용)
 */
export const websiteDesignPageInfo = {
  object: "page",
  id: "e7b780d5-b655-4f4e-8bc9-57dcfcebfab3",
  created_time: "2023-08-30T00:15:00.000Z",
  last_edited_time: "2025-08-09T05:40:00.000Z",
  properties: {
    "이름": {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: {
            content: "웹사이트 디자인",
            link: null
          },
          plain_text: "웹사이트 디자인",
          href: null
        }
      ]
    }
  }
} as const

/**
 * 페이지 내 블록 구조 (blocks.children.list 응답 모킹용)
 */
export const websiteDesignBlocks = [
  // 1. Callout 블록: "웹사이트 디자인은 가이드 순서대로 작업해 주시길 권장드리고 있어요!"
  {
    object: "block",
    id: "b9c98560-17dc-457c-b0c5-d7582fadd75b",
    type: "callout",
    has_children: false,
    callout: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "웹사이트 디자인은 ",
            link: null
          },
          plain_text: "웹사이트 디자인은 ",
          href: null
        },
        {
          type: "text",
          text: {
            content: "가이드 순서대로",
            link: null
          },
          annotations: { bold: true },
          plain_text: "가이드 순서대로",
          href: null
        },
        {
          type: "text",
          text: {
            content: " 작업해 주시길 권장드리고 있어요!",
            link: null
          },
          plain_text: " 작업해 주시길 권장드리고 있어요!",
          href: null
        }
      ],
      icon: { type: "emoji", emoji: "🎨" },
      color: "default_background"
    }
  },
  
  // 2. 빈 Paragraph (섹션 구분자)
  {
    object: "block",
    id: "1524b16e-2bf1-80d6-852a-eb4f4d8197da",
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [],
      color: "default"
    }
  },

  // 3. Column List 블록 (컬럼 구조의 시작)
  {
    object: "block",
    id: "1524b16e-2bf1-8047-ba78-d4a9a6d86722",
    type: "column_list",
    has_children: true,
    column_list: {}
  },

  // 4. 마지막 Paragraph
  {
    object: "block",
    id: "17b4b16e-2bf1-80d9-897c-c0253f5af0fb",
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [],
      color: "default"
    }
  }
] as const

/**
 * Column 내부 블록들 (실제 컬럼 내부 구조)
 */
export const websiteDesignColumnBlocks = [
  // 고급 코스 Callout
  {
    object: "block",
    id: "1524b16e-2bf1-8092-bdcf-d7438d4a420e",
    type: "callout",
    has_children: false,
    callout: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "고급 코스\n코드를 다룰 줄 안다면 더 특별한 웹사이트가 돼요.",
            link: null
          },
          plain_text: "고급 코스\n코드를 다룰 줄 안다면 더 특별한 웹사이트가 돼요.",
          href: null
        }
      ],
      icon: { type: "emoji", emoji: "⚡" },
      color: "default_background"
    }
  },

  // 하위 페이지들
  {
    object: "block",
    id: "1594b16e-2bf1-80c3-b713-e8c0dbabb5db",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "블록 메이커"
    }
  },
  {
    object: "block",
    id: "8b5324cd-90ac-4a1d-b884-719bb887460c",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "HTML 섹션"
    }
  },
  {
    object: "block",
    id: "14b4b16e-2bf1-8084-8454-ce8f44864b2a",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "공통 코드 편집"
    }
  },

  // Paragraph + Link
  {
    object: "block",
    id: "17b4b16e-2bf1-8094-bb3d-d0366beac5f7",
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "👉 ",
            link: null
          },
          plain_text: "👉 ",
          href: null
        },
        {
          type: "text",
          text: {
            content: "디자인/기능 제작 의뢰하기",
            link: {
              url: "https://bit.ly/3WgTNCY"
            }
          },
          plain_text: "디자인/기능 제작 의뢰하기",
          href: "https://bit.ly/3WgTNCY"
        }
      ]
    }
  },

  // 주제별 활용 코스 Callout
  {
    object: "block",
    id: "1524b16e-2bf1-80ba-bb70-d48c79741eb3",
    type: "callout",
    has_children: false,
    callout: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "주제별 활용 코스\n주제별로 웹사이트 구성을 간단히 따라 해 볼 수 있어요.",
            link: null
          },
          plain_text: "주제별 활용 코스\n주제별로 웹사이트 구성을 간단히 따라 해 볼 수 있어요.",
          href: null
        }
      ],
      icon: { type: "emoji", emoji: "📚" },
      color: "default_background"
    }
  },

  // 두 번째 섹션 하위 페이지들 (5개)
  {
    object: "block",
    id: "10a4b16e-2bf1-80ef-b196-c390b8965245",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "이미지 설정 가이드"
    }
  },
  {
    object: "block",
    id: "cbc07e9b-2585-4976-9294-d7a53da5f0d8",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "메뉴 1분 만에 추가하기"
    }
  },
  {
    object: "block",
    id: "dab2cd21-d15d-431d-8324-48f51d96b82f",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "갤러리 섹션으로 룩북 구성하기"
    }
  },
  {
    object: "block",
    id: "11c4b16e-2bf1-80f1-b0df-cdd057b79b18",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "상점 준비 중/리뉴얼 페이지 만들기"
    }
  },
  {
    object: "block",
    id: "1854b16e-2bf1-8001-a7f2-d437c4bfb50c",
    type: "child_page",
    has_children: true,
    child_page: {
      title: "쇼핑몰 주요 메뉴 따라 하기 (NEW!)"
    }
  },

  // 마지막 섹션 - 의견 수렴
  {
    object: "block",
    id: "7c9d0db8-a654-4c6d-84cd-58fcd3564d36",
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "필요한 웹사이트 디자인 가이드가 있으신가요?\n아래 링크로, 원하시는 가이드 주제를 알려 주세요!",
            link: null
          },
          plain_text: "필요한 웹사이트 디자인 가이드가 있으신가요?\n아래 링크로, 원하시는 가이드 주제를 알려 주세요!",
          href: null
        }
      ]
    }
  },
  {
    object: "block",
    id: "1524b16e-2bf1-80f3-be87-de215ce3c696",
    type: "bookmark",
    has_children: false,
    bookmark: {
      url: "https://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform",
      caption: []
    }
  }
] as const

/**
 * 예상되는 의미 단위 청킹 결과
 */
export const expectedSemanticChunks = [
  {
    type: "callout_section",
    markdown: "웹사이트 디자인은 **가이드 순서대로** 작업해 주시길 권장드리고 있어요!",
    vectorText: "웹사이트 디자인은 **가이드 순서대로** 작업해 주시길 권장드리고 있어요!",
    links: [],
    blockIds: ["b9c98560-17dc-457c-b0c5-d7582fadd75b"]
  },
  {
    type: "callout_section",
    markdown: "고급 코스\n코드를 다룰 줄 안다면 더 특별한 웹사이트가 돼요.\n\n관련 페이지: 블록 메이커, HTML 섹션, 공통 코드 편집",
    vectorText: "고급 코스\n코드를 다룰 줄 안다면 더 특별한 웹사이트가 돼요.\n\n관련 페이지: 블록 메이커 (https://sellerhub.notion.site/1594b16e2bf180c3b713e8c0dbabb5db), HTML 섹션 (https://sellerhub.notion.site/8b5324cd90ac4a1db884719bb887460c), 공통 코드 편집 (https://sellerhub.notion.site/14b4b16e2bf180848454ce8f44864b2a)",
    links: ["https://bit.ly/3WgTNCY"],
    blockIds: ["1524b16e-2bf1-8092-bdcf-d7438d4a420e", "1594b16e-2bf1-80c3-b713-e8c0dbabb5db", "8b5324cd-90ac-4a1d-b884-719bb887460c", "14b4b16e-2bf1-8084-8454-ce8f44864b2a", "17b4b16e-2bf1-8094-bb3d-d0366beac5f7"]
  },
  {
    type: "callout_section", 
    markdown: "주제별 활용 코스\n주제별로 웹사이트 구성을 간단히 따라 해 볼 수 있어요.\n\n관련 페이지: 이미지 설정 가이드, 메뉴 1분 만에 추가하기, 갤러리 섹션으로 룩북 구성하기, 상점 준비 중/리뉴얼 페이지 만들기, 쇼핑몰 주요 메뉴 따라 하기 (NEW!)",
    vectorText: "주제별 활용 코스\n주제별로 웹사이트 구성을 간단히 따라 해 볼 수 있어요.\n\n관련 페이지: 이미지 설정 가이드 (https://sellerhub.notion.site/10a4b16e2bf180efb196c390b8965245), 메뉴 1분 만에 추가하기 (https://sellerhub.notion.site/cbc07e9b258549769294d7a53da5f0d8), 갤러리 섹션으로 룩북 구성하기 (https://sellerhub.notion.site/dab2cd21d15d431d832448f51d96b82f), 상점 준비 중/리뉴얼 페이지 만들기 (https://sellerhub.notion.site/11c4b16e2bf180f1b0dfcdd057b79b18), 쇼핑몰 주요 메뉴 따라 하기 (NEW!) (https://sellerhub.notion.site/1854b16e2bf18001a7f2d437c4bfb50c)",
    links: [],
    blockIds: ["1524b16e-2bf1-80ba-bb70-d48c79741eb3", "10a4b16e-2bf1-80ef-b196-c390b8965245", "cbc07e9b-2585-4976-9294-d7a53da5f0d8", "dab2cd21-d15d-431d-8324-48f51d96b82f", "11c4b16e-2bf1-80f1-b0df-cdd057b79b18", "1854b16e-2bf1-8001-a7f2-d437c4bfb50c"]
  },
  {
    type: "content_section",
    markdown: "필요한 웹사이트 디자인 가이드가 있으신가요?\n아래 링크로, 원하시는 가이드 주제를 알려 주세요!\nhttps://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform",
    vectorText: "필요한 웹사이트 디자인 가이드가 있으신가요?\n아래 링크로, 원하시는 가이드 주제를 알려 주세요!\nhttps://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform",
    links: ["https://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform"],
    blockIds: ["7c9d0db8-a654-4c6d-84cd-58fcd3564d36", "1524b16e-2bf1-80f3-be87-de215ce3c696"]
  }
] as const