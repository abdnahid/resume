import { prisma } from "@/lib/prisma";

// ─── Flat post list with ancestry path ───────────────────────────────────────

export type OrgPostFlat = {
  id: number;
  nameBn: string;
  nameEn: string;
  grade: string;
  rootId: number;    // top-level ancestor OrgUnit id
  pathBn: string[];  // [rootName, ...intermediates, directUnitName] root-first
};

export type OrgRoot = {
  id: number;
  nameBn: string;
  nameEn: string;
  category: string;
};

export async function getOrgPostsFlat(): Promise<OrgPostFlat[]> {
  const units = await prisma.orgUnit.findMany({
    where: { isActive: true },
    include: { posts: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const unitMap = new Map(units.map((u) => [u.id, u]));

  function ancestors(id: number, seen = new Set<number>()): { id: number; nameBn: string }[] {
    if (seen.has(id)) return [];
    seen.add(id);
    const u = unitMap.get(id);
    if (!u) return [];
    const self = { id: u.id, nameBn: u.nameBn };
    if (u.parentId == null) return [self];
    return [...ancestors(u.parentId, seen), self];
  }

  const result: OrgPostFlat[] = [];
  for (const unit of units) {
    if (!unit.posts.length) continue;
    const chain = ancestors(unit.id);
    if (!chain.length) continue;
    const rootId = chain[0].id;
    const pathBn = chain.map((a) => a.nameBn);
    for (const post of unit.posts) {
      result.push({ id: post.id, nameBn: post.nameBn, nameEn: post.nameEn, grade: post.grade ?? "", rootId, pathBn });
    }
  }
  return result;
}

export async function getOrgRoots(): Promise<OrgRoot[]> {
  return prisma.orgUnit.findMany({
    where: { parentId: null, isActive: true },
    select: { id: true, nameBn: true, nameEn: true, category: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Office → OrgUnit root mapping ───────────────────────────────────────────
// Extracts the city/region name from "Regional Office, BSTI, Gazipur" → "Gazipur"
// and matches it to the root OrgUnit with the same nameEn.
export function resolveOfficeRootId(
  officeNameEn: string,
  officeType: string,
  roots: OrgRoot[],
): number | null {
  if (officeType === "head") return null;

  const byName = new Map(roots.map((r) => [r.nameEn.toLowerCase(), r.id]));

  if (officeType === "dmi") {
    const dmi = roots.find((r) => r.nameEn.includes("DMI"));
    return dmi?.id ?? null;
  }

  // Last segment after the last comma: "Regional Office, BSTI, Gazipur" → "Gazipur"
  const parts = officeNameEn.split(",");
  const city = parts[parts.length - 1].trim().toLowerCase();
  return byName.get(city) ?? null;
}

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

export async function getOrgTree(): Promise<UnitNode[]> {
  const units = await prisma.orgUnit.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      posts: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { employees: true } } },
      },
    },
  });

  function nest(parentId: number | null): UnitNode[] {
    return units
      .filter((u) => (u.parentId ?? null) === parentId)
      .map((u) => ({
        id: u.id,
        slug: u.slug,
        nameEn: u.nameEn,
        nameBn: u.nameBn,
        category: u.category,
        parentId: u.parentId,
        sortOrder: u.sortOrder,
        isActive: u.isActive,
        posts: u.posts.map((p) => ({
          id: p.id,
          nameEn: p.nameEn,
          nameBn: p.nameBn,
          sanctionedCount: p.sanctionedCount,
          sortOrder: p.sortOrder,
          isActive: p.isActive,
          employeeCount: p._count.employees,
        })),
        children: nest(u.id),
      }));
  }

  return nest(null);
}

export function sumSanctioned(unit: UnitNode): number {
  const own = unit.posts.reduce((s, p) => s + p.sanctionedCount, 0);
  const child = unit.children.reduce((s, c) => s + sumSanctioned(c), 0);
  return own + child;
}
