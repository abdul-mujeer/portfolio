import { nowIso } from './datetime.js';

/**
 * Every create / update / status change / comment goes through this helper so the
 * activity feed stays complete. `detail_json` always contains a machine-readable
 * JSON payload describing the change.
 */
export function recordActivity(db, { projectId, taskId = null, actorId, action, detail = {}, at }) {
  db.prepare(
    `INSERT INTO activity (project_id, task_id, actor_id, action, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(projectId, taskId, actorId, action, JSON.stringify(detail), at || nowIso());
}
