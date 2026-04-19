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
    areas: ['Blog', 'Auto publishing', 'MCP'],
    title: 'The changelog is now live',
    description:
      'Codebase now records user-facing product changes by version so you can scan what changed without reading through internal release notes.',
    details: [
      'The home header now includes a direct entry point to the updates page.',
      'The profile menu now includes a shortcut for automated publishing setup.',
      'Post detail pages now support signed-in sharing for GitHub resources.',
    ],
  },
];
