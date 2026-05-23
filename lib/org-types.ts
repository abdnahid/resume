export type PostNode = {
  id: number;
  nameEn: string;
  nameBn: string;
  sanctionedCount: number;
  sortOrder: number;
  isActive: boolean;
  employeeCount: number;
};

export type UnitNode = {
  id: number;
  slug: string;
  nameEn: string;
  nameBn: string;
  category: string;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  posts: PostNode[];
  children: UnitNode[];
};

export function sumSanctioned(unit: UnitNode): number {
  const own = unit.posts.reduce((s, p) => s + p.sanctionedCount, 0);
  const child = unit.children.reduce((s, c) => s + sumSanctioned(c), 0);
  return own + child;
}
