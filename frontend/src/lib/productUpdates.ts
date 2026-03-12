export type ProductUpdateType = 'New' | 'Improved' | 'Fix' | 'Update';

export interface ProductUpdateEntry {
  id: string;
  version: string;
  date: string;
  monthLabel: string;
  type: ProductUpdateType;
  areas: string[];
  title: string;
  description: string;
  details?: string[];
}

export const PRODUCT_UPDATES: ProductUpdateEntry[] = [
  {
    id: '2026-03-11-v1-0-0',
    version: 'v1.0.0',
    date: 'Mar 11',
    monthLabel: 'March, 2026',
    type: 'Update',
    areas: ['블로그', '자동포스팅', 'MCP'],
    title: '이제 업데이트 기능을 확인할 수 있습니다',
    description:
      '이제부터 Codebase에서 사용자에게 직접 보이는 변경만 버전별로 기록합니다. 기능이 어떻게 바뀌었는지 빠르게 따라잡을 수 있도록 changelog 형식으로 정리합니다.',
    details: [
      '홈 화면 헤더에 업데이트 페이지 진입 버튼이 추가되었습니다.',
      '프로필 메뉴에 자동포스팅 연결 바로가기가 추가되었습니다.',
      '포스트 상세에서 GitHub 리소스를 로그인 기반으로 공유할 수 있게 되었습니다.',
    ],
  },
];
