import { sql } from "@vercel/postgres";
import type { RarityKey, RoleCategory, CardRow } from "./cardLogic";

export type { CardRow };

export async function insertPendingCard(deleteTokenHash: string): Promise<number> {
  const { rows } = await sql<{ id: number }>`
    INSERT INTO cards (status, delete_token_hash)
    VALUES ('pending', ${deleteTokenHash})
    RETURNING id;
  `;
  return rows[0].id;
}

export async function finalizeCard(params: {
  id: number;
  name: string;
  role: string;
  roleCategory: RoleCategory;
  builderClass: string;
  rarityKey: RarityKey;
  imageUrl: string;
}): Promise<CardRow | null> {
  const { rows } = await sql<CardRow>`
    UPDATE cards
    SET status = 'complete',
        name = ${params.name},
        role = ${params.role},
        role_category = ${params.roleCategory},
        builder_class = ${params.builderClass},
        rarity_key = ${params.rarityKey},
        image_url = ${params.imageUrl}
    WHERE id = ${params.id}
    RETURNING id, status, name, role, role_category, builder_class, rarity_key, image_url, created_at;
  `;
  return rows[0] ?? null;
}

export async function getCompleteCardById(id: number): Promise<CardRow | null> {
  const { rows } = await sql<CardRow>`
    SELECT id, status, name, role, role_category, builder_class, rarity_key, image_url, created_at
    FROM cards
    WHERE id = ${id} AND status = 'complete'
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

export async function getDeleteTokenHash(id: number): Promise<string | null> {
  const { rows } = await sql<{ delete_token_hash: string }>`
    SELECT delete_token_hash FROM cards WHERE id = ${id} LIMIT 1;
  `;
  return rows[0]?.delete_token_hash ?? null;
}

export async function getImageUrlById(id: number): Promise<string | null> {
  const { rows } = await sql<{ image_url: string | null }>`
    SELECT image_url FROM cards WHERE id = ${id} LIMIT 1;
  `;
  return rows[0]?.image_url ?? null;
}

export async function deleteCardById(id: number): Promise<void> {
  await sql`DELETE FROM cards WHERE id = ${id};`;
}

export async function searchCards(params: {
  q?: string;
  id?: number;
  category?: RoleCategory;
  limit: number;
  offset: number;
}): Promise<{ rows: CardRow[]; total: number }> {
  const { q, id, category, limit, offset } = params;

  if (id != null) {
    const { rows } = await sql<CardRow>`
      SELECT id, status, name, role, role_category, builder_class, rarity_key, image_url, created_at
      FROM cards WHERE id = ${id} AND status = 'complete' LIMIT 1;
    `;
    return { rows, total: rows.length };
  }

  const nameFilter = q ? `%${q.toLowerCase()}%` : null;

  const { rows } = await sql<CardRow>`
    SELECT id, status, name, role, role_category, builder_class, rarity_key, image_url, created_at
    FROM cards
    WHERE status = 'complete'
      AND (${nameFilter}::text IS NULL OR lower(name) LIKE ${nameFilter})
      AND (${category ?? null}::text IS NULL OR role_category = ${category ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const { rows: countRows } = await sql<{ count: string }>`
    SELECT count(*)::text AS count
    FROM cards
    WHERE status = 'complete'
      AND (${nameFilter}::text IS NULL OR lower(name) LIKE ${nameFilter})
      AND (${category ?? null}::text IS NULL OR role_category = ${category ?? null});
  `;

  return { rows, total: parseInt(countRows[0]?.count ?? "0", 10) };
}

export async function cleanupStalePending(olderThanMinutes = 60): Promise<number> {
  const { rowCount } = await sql`
    DELETE FROM cards
    WHERE status = 'pending'
      AND created_at < now() - make_interval(mins => ${olderThanMinutes});
  `;
  return rowCount ?? 0;
}
