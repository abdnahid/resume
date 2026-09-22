export type PostNode = {
  id: number;
  nameEn: string;
  nameBn: string;
  sanctionedCount: number;
  sortOrder: number;
  isActive: boolean;
  employeeCount: number;
  /** False for a desk created outside the approved organogram (D155). */
  isSanctioned: boolean;
  createdReason: string | null;
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
  /** False for a section created outside the approved organogram (D157). */
  isSanctioned: boolean;
  createdReason: string | null;
  posts: PostNode[];
  children: UnitNode[];
};

/** Sanctioned seats only — a desk outside the organogram counts for none. */
export function sumSanctioned(unit: UnitNode): number {
  const own = unit.posts.reduce((s, p) => s + (p.isSanctioned ? p.sanctionedCount : 0), 0);
  const child = unit.children.reduce((s, c) => s + sumSanctioned(c), 0);
  return own + child;
}
