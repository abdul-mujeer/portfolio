/** Serializers shared by routes. */

export function serializeActivity(row) {
  let detail = {};
  try {
    detail = row.detail_json ? JSON.parse(row.detail_json) : {};
  } catch {
    detail = {};
  }
  return {
    id: row.id,
    project_id: row.project_id,
    task_id: row.task_id ?? null,
    task_title: row.task_title ?? null,
    actor_id: row.actor_id,
    actor_name: row.actor_name ?? null,
    action: row.action,
    detail,
    created_at: row.created_at,
  };
}

export function serializeComment(row) {
  return {
    id: row.id,
    task_id: row.task_id,
    author_id: row.author_id,
    author_name: row.author_name ?? null,
    body: row.body,
    created_at: row.created_at,
  };
}
