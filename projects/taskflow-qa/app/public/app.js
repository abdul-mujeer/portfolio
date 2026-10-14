/**
 * TaskFlow console - vanilla ES module, no build step, fetch-based.
 *
 * All rendering uses textContent (never innerHTML with user data), so task
 * titles/descriptions containing markup are displayed as text (verified in
 * tests/ui/security.spec.ts).
 *
 * Authorization is enforced server-side; UI hiding is only a convenience.
 */

const $ = (id) => document.getElementById(id);

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED'];
const STATUS_LABELS = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  CANCELED: 'Canceled',
};
const ADMIN_ROLES = ['OWNER', 'ADMIN'];

const state = {
  user: null,
  projects: [],
  project: null,
  myRole: null,
  members: [],
  tasks: [],
  total: 0,
  page: 1,
  limit: 10,
  filters: { status: '', priority: '', assigneeId: '', overdue: false },
  editingTask: null,
  openerElement: null,
};

// --------------------------------------------------------------------- API

async function apiRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const error = new Error(payload?.error?.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.payload = payload ?? { error: { code: 'UNKNOWN', message: `HTTP ${res.status}` } };
    throw error;
  }
  return payload;
}

// ------------------------------------------------------------------ errors

function showErrorText(text) {
  $('error-banner-text').textContent = text;
  $('error-banner').hidden = false;
}

function clearError() {
  $('error-banner').hidden = true;
  $('error-banner-text').textContent = '';
}

function handleApiError(error) {
  const status = error.status;
  const payload = error.payload ?? {};
  const code = payload?.error?.code ? ` (${payload.error.code})` : '';
  const message = payload?.error?.message ?? error.message;
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
  const detailText = details.length
    ? ' - ' + details.map((d) => `${d.path}: ${d.message}`).join('; ')
    : '';
  showErrorText(`Error ${status ?? ''}${code}: ${message}${detailText}`);

  if (status === 401 && state.user) {
    // session expired while using the console
    resetToLogin();
  }
}

// ------------------------------------------------------------------- views

function showLoginView() {
  $('login-view').hidden = false;
  $('board-view').hidden = true;
  $('session-box').hidden = true;
  $('login-password').value = '';
  $('login-email').focus();
}

function resetToLogin() {
  state.user = null;
  state.projects = [];
  state.project = null;
  state.myRole = null;
  state.tasks = [];
  state.total = 0;
  state.page = 1;
  closeModal(true);
  showLoginView();
}

async function afterLogin() {
  $('session-box').hidden = false;
  $('current-user').textContent = `${state.user.display_name} <${state.user.email}>`;
  $('login-view').hidden = true;
  $('board-view').hidden = false;
  await loadProjects();
}

// ---------------------------------------------------------------- projects

async function loadProjects() {
  const res = await apiRequest('/projects?limit=100');
  state.projects = res.data;
  const select = $('project-switcher');
  select.innerHTML = '';
  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = String(project.id);
    option.textContent = `${project.key} - ${project.name}${project.archived ? ' (archived)' : ''}`;
    select.append(option);
  }
  if (!state.projects.length) {
    state.project = null;
    state.myRole = null;
    state.tasks = [];
    state.total = 0;
    renderBoard();
    renderPagination();
    $('activity-feed').innerHTML = '';
    $('board-status').textContent = 'You are not a member of any project yet.';
    $('task-create-button').hidden = true;
    $('project-archive').hidden = true;
    return;
  }
  const preferred = state.projects.find((p) => !p.archived) ?? state.projects[0];
  select.value = String(preferred.id);
  await selectProject(preferred.id);
}

async function selectProject(projectId) {
  state.project = state.projects.find((p) => p.id === projectId) ?? null;
  state.myRole = state.project?.my_role ?? null;
  state.page = 1;
  clearError();
  $('project-role').textContent = state.myRole ?? '';
  const archived = !!state.project?.archived;
  $('project-archive').hidden = !(ADMIN_ROLES.includes(state.myRole) && !archived);
  $('task-create-button').hidden = archived;
  if (!state.project) return;
  await Promise.all([loadMembers(), loadTasks(), loadActivity()]);
}

function canAdmin() {
  return ADMIN_ROLES.includes(state.myRole);
}

// ----------------------------------------------------------------- members

async function loadMembers() {
  const res = await apiRequest(`/projects/${state.project.id}/members`);
  state.members = res.data;

  const filter = $('filter-assignee');
  filter.innerHTML = '<option value="">All</option>';
  for (const member of state.members) {
    const option = document.createElement('option');
    option.value = String(member.user_id);
    option.textContent = member.display_name;
    filter.append(option);
  }
  filter.value = state.filters.assigneeId;

  const assignee = $('task-assignee');
  assignee.innerHTML = '<option value="">Unassigned</option>';
  for (const member of state.members) {
    const option = document.createElement('option');
    option.value = String(member.user_id);
    option.textContent = `${member.display_name}`;
    assignee.append(option);
  }
}

// ------------------------------------------------------------------- tasks

async function loadTasks() {
  if (!state.project) return;
  // newest-first keeps freshly created tasks on page 1 (stable tie-break by id)
  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
    sort: 'created_at',
    order: 'desc',
  });
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.priority) params.set('priority', state.filters.priority);
  if (state.filters.assigneeId) params.set('assigneeId', state.filters.assigneeId);
  if (state.filters.overdue) params.set('overdue', 'true');

  const res = await apiRequest(`/projects/${state.project.id}/tasks?${params.toString()}`);
  state.tasks = res.data;
  state.total = res.total;
  renderBoard();
  renderPagination();
}

function buildCard(task) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.setAttribute('data-testid', 'task-card');
  card.dataset.taskId = String(task.id);
  card.dataset.overdue = String(task.overdue);
  card.setAttribute('aria-label', `Task ${task.title}`);

  const title = document.createElement('span');
  title.className = 'card-title';
  title.setAttribute('data-testid', 'task-card-title');
  title.textContent = task.title;
  card.append(title);

  const meta = document.createElement('span');
  meta.className = 'meta';

  const priority = document.createElement('span');
  priority.className = `badge ${task.priority}`;
  priority.setAttribute('data-testid', 'task-priority-badge');
  priority.textContent = task.priority;
  meta.append(priority);

  if (task.overdue) {
    const overdue = document.createElement('span');
    overdue.className = 'badge overdue';
    overdue.setAttribute('data-testid', 'task-overdue-badge');
    overdue.textContent = 'Overdue';
    meta.append(overdue);
  }

  const assignee = document.createElement('span');
  assignee.textContent = task.assignee_name ? `@${task.assignee_name}` : 'unassigned';
  meta.append(assignee);

  if (task.due_date) {
    const due = document.createElement('span');
    due.textContent = `due ${task.due_date}`;
    meta.append(due);
  }
  if (task.comment_count) {
    const comments = document.createElement('span');
    comments.textContent = `${task.comment_count} comment${task.comment_count === 1 ? '' : 's'}`;
    meta.append(comments);
  }
  card.append(meta);
  card.addEventListener('click', () => openModal(task, card));
  return card;
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  for (const status of STATUSES) {
    const column = document.createElement('section');
    column.className = 'column';
    column.setAttribute('data-testid', `column-${status}`);
    column.setAttribute('aria-label', `${STATUS_LABELS[status]} column`);

    const tasks = state.tasks.filter((t) => t.status === status);
    const heading = document.createElement('h3');
    const label = document.createElement('span');
    label.textContent = STATUS_LABELS[status];
    const count = document.createElement('span');
    count.setAttribute('data-testid', `column-count-${status}`);
    count.textContent = String(tasks.length);
    heading.append(label, count);
    column.append(heading);

    const list = document.createElement('ul');
    list.className = 'cards';
    if (!tasks.length) {
      const empty = document.createElement('li');
      empty.className = 'column-empty';
      empty.textContent = 'No tasks';
      list.append(empty);
    } else {
      for (const task of tasks) list.append(buildCard(task));
    }
    column.append(list);
    board.append(column);
  }
  $('empty-state').hidden = state.total !== 0;
  $('board-status').textContent = state.project
    ? `Showing ${state.tasks.length} of ${state.total} task(s) in ${state.project.key}`
    : '';
}

function renderPagination() {
  const pages = Math.max(1, Math.ceil(state.total / state.limit));
  $('pagination-info').textContent = `Page ${state.page} of ${pages} (${state.total} tasks)`;
  $('pagination-prev').disabled = state.page <= 1;
  $('pagination-next').disabled = state.page >= pages;
}

// ---------------------------------------------------------------- activity

const ACTION_LABELS = {
  PROJECT_CREATED: 'created the project',
  PROJECT_UPDATED: 'updated the project',
  PROJECT_ARCHIVED: 'archived the project',
  PROJECT_OWNER_TRANSFERRED: 'transferred ownership',
  MEMBER_ADDED: 'added a member',
  MEMBER_ROLE_CHANGED: 'changed a member role',
  MEMBER_REMOVED: 'removed a member',
  TASK_CREATED: 'created a task',
  TASK_UPDATED: 'updated a task',
  TASK_STATUS_CHANGED: 'changed status',
  TASK_DELETED: 'deleted a task',
  COMMENT_ADDED: 'commented',
};

async function loadActivity() {
  const res = await apiRequest(`/projects/${state.project.id}/activity?limit=10`);
  const feed = $('activity-feed');
  feed.innerHTML = '';
  for (const row of res.data) {
    const item = document.createElement('li');
    item.setAttribute('data-testid', 'activity-item');
    item.dataset.action = row.action;

    const action = document.createElement('span');
    action.className = 'action';
    let label = ACTION_LABELS[row.action] ?? row.action;
    if (row.action === 'TASK_STATUS_CHANGED' && row.detail?.to) label += ` to ${row.detail.to}`;
    action.textContent = label;
    item.append(action);

    const what = document.createElement('span');
    what.textContent = row.task_title ? `"${row.task_title}"` : '';
    item.append(what);

    const who = document.createElement('span');
    who.textContent = row.actor_name ?? '';
    item.append(who);

    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = timeAgo(row.created_at);
    item.append(when);

    feed.append(item);
  }
  if (!res.data.length) {
    const item = document.createElement('li');
    item.textContent = 'No activity yet.';
    feed.append(item);
  }
}

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ------------------------------------------------------------------ modal

const MODAL_FOCUSABLE = 'input, select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function openModal(task, opener) {
  state.editingTask = task;
  state.openerElement = opener ?? document.activeElement;
  const archived = !!state.project?.archived;

  $('task-modal-title').textContent = task ? `Task #${task.id}` : 'New task';
  $('task-title').value = task ? task.title : '';
  $('task-description').value = task ? task.description ?? '' : '';
  $('task-priority').value = task ? task.priority : 'MEDIUM';
  $('task-assignee').value = task && task.assignee_id ? String(task.assignee_id) : '';
  $('task-due').value = task ? task.due_date ?? '' : '';
  $('task-estimated').value = task && task.estimated_hours !== null ? String(task.estimated_hours) : '';

  const canEdit = task
    ? canAdmin() || task.reporter_id === state.user.id || task.assignee_id === state.user.id
    : true;

  // status select (edit mode only)
  $('status-field').hidden = !task;
  if (task) {
    const select = $('task-status-select');
    select.innerHTML = '';
    for (const status of STATUSES) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      select.append(option);
    }
    select.value = task.status;
    select.disabled = !canEdit || archived;
  }

  // delete button (reporter or admin/owner)
  const canDelete = task && (canAdmin() || task.reporter_id === state.user.id);
  $('task-delete').hidden = !canDelete;
  $('task-delete').dataset.taskId = task ? String(task.id) : '';

  // comments (edit mode only)
  $('comments-section').hidden = !task;
  $('comment-body').disabled = archived;
  $('comment-submit').disabled = archived;

  // form enabled state
  const formControls = [$('task-title'), $('task-description'), $('task-priority'), $('task-assignee'), $('task-due'), $('task-estimated'), $('task-save')];
  for (const control of formControls) control.disabled = !canEdit || archived;

  $('task-modal-backdrop').hidden = false;
  $('task-modal').hidden = false;
  $('task-title').focus();

  if (task) loadComments(task.id);
}

function closeModal(skipFocus) {
  $('task-modal').hidden = true;
  $('task-modal-backdrop').hidden = true;
  state.editingTask = null;
  if (!skipFocus && state.openerElement && document.contains(state.openerElement)) {
    state.openerElement.focus();
  }
  state.openerElement = null;
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = $('task-modal');
  const focusables = [...modal.querySelectorAll(MODAL_FOCUSABLE)].filter(
    (el) => el.offsetParent !== null && !el.disabled
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// --------------------------------------------------------------- comments

async function loadComments(taskId) {
  const list = $('comment-list');
  list.innerHTML = '';
  const res = await apiRequest(`/tasks/${taskId}/comments?limit=100`);
  if (!res.data.length) {
    const item = document.createElement('li');
    item.className = 'empty-comments';
    item.textContent = 'No comments yet.';
    list.append(item);
    return;
  }
  for (const comment of res.data) {
    const item = document.createElement('li');
    item.setAttribute('data-testid', 'comment-item');
    item.dataset.commentId = String(comment.id);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const author = document.createElement('span');
    author.textContent = comment.author_name ?? `user ${comment.author_id}`;
    const when = document.createElement('span');
    when.textContent = timeAgo(comment.created_at);
    meta.append(author, when);

    const body = document.createElement('div');
    body.setAttribute('data-testid', 'comment-text');
    body.textContent = comment.body;

    item.append(meta, body);
    list.append(item);
  }
}

// ---------------------------------------------------------------- actions

async function refreshAfterMutation() {
  await Promise.all([loadTasks(), loadActivity()]);
}

async function onSubmitTaskForm(event) {
  event.preventDefault();
  const editing = state.editingTask;
  const payload = {
    title: $('task-title').value,
    description: $('task-description').value === '' ? null : $('task-description').value,
    priority: $('task-priority').value,
    assigneeId: $('task-assignee').value === '' ? null : Number($('task-assignee').value),
    dueDate: $('task-due').value === '' ? null : $('task-due').value,
    estimatedHours: $('task-estimated').value === '' ? null : Number($('task-estimated').value),
  };
  try {
    if (editing) {
      const updated = await apiRequest(`/tasks/${editing.id}`, { method: 'PATCH', body: payload });
      state.editingTask = updated;
    } else {
      await apiRequest(`/projects/${state.project.id}/tasks`, { method: 'POST', body: payload });
      // newest-first ordering puts the new task at the top of page 1
      state.page = 1;
    }
    clearError();
    closeModal();
    await refreshAfterMutation();
  } catch (error) {
    handleApiError(error);
  }
}

async function onStatusChange(event) {
  const task = state.editingTask;
  if (!task) return;
  const target = event.target.value;
  try {
    const updated = await apiRequest(`/tasks/${task.id}/status`, {
      method: 'PATCH',
      body: { status: target },
    });
    state.editingTask = updated;
    clearError();
    await refreshAfterMutation();
  } catch (error) {
    event.target.value = task.status;
    handleApiError(error);
  }
}

async function onCommentSubmit(event) {
  event.preventDefault();
  const task = state.editingTask;
  if (!task) return;
  const body = $('comment-body').value;
  try {
    await apiRequest(`/tasks/${task.id}/comments`, { method: 'POST', body: { body } });
    clearError();
    $('comment-body').value = '';
    await loadComments(task.id);
    await loadActivity();
    await loadTasks();
  } catch (error) {
    handleApiError(error);
  }
}

async function onDeleteTask() {
  const task = state.editingTask;
  if (!task) return;
  try {
    await apiRequest(`/tasks/${task.id}`, { method: 'DELETE' });
    clearError();
    closeModal();
    await refreshAfterMutation();
  } catch (error) {
    handleApiError(error);
  }
}

async function onArchiveProject() {
  try {
    await apiRequest(`/projects/${state.project.id}/archive`, { method: 'POST' });
    clearError();
    state.project.archived = true;
    $('project-archive').hidden = true;
    $('task-create-button').hidden = true;
    await refreshAfterMutation();
  } catch (error) {
    handleApiError(error);
  }
}

function openCreate(opener) {
  $('task-assignee').value = '';
  openModal(null, opener);
}

// ------------------------------------------------------------------- wiring

function applyFilters(event) {
  event.preventDefault();
  state.filters.status = $('filter-status').value;
  state.filters.priority = $('filter-priority').value;
  state.filters.assigneeId = $('filter-assignee').value;
  state.filters.overdue = $('filter-overdue').checked;
  state.page = 1;
  loadTasks().catch(handleApiError);
}

function resetFilters() {
  $('filter-status').value = '';
  $('filter-priority').value = '';
  $('filter-assignee').value = '';
  $('filter-overdue').checked = false;
  applyFilters(new Event('submit'));
}

async function boot() {
  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      state.user = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: $('login-email').value, password: $('login-password').value },
      });
      clearError();
      await afterLogin();
    } catch (error) {
      handleApiError(error);
    }
  });

  $('logout-button').addEventListener('click', async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // logging out locally is fine even if the call fails
    }
    clearError();
    resetToLogin();
  });

  $('error-dismiss').addEventListener('click', clearError);
  $('project-switcher').addEventListener('change', (event) => {
    selectProject(Number(event.target.value)).catch(handleApiError);
  });
  $('task-create-button').addEventListener('click', (event) => openCreate(event.currentTarget));
  $('project-archive').addEventListener('click', onArchiveProject);
  $('filters').addEventListener('submit', applyFilters);
  $('filter-reset').addEventListener('click', resetFilters);
  $('pagination-prev').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadTasks().catch(handleApiError);
    }
  });
  $('pagination-next').addEventListener('click', () => {
    state.page += 1;
    loadTasks().catch(handleApiError);
  });

  $('task-form').addEventListener('submit', onSubmitTaskForm);
  $('modal-close').addEventListener('click', () => closeModal());
  $('task-cancel').addEventListener('click', () => closeModal());
  $('task-status-select').addEventListener('change', onStatusChange);
  $('comment-form').addEventListener('submit', onCommentSubmit);
  $('task-delete').addEventListener('click', onDeleteTask);
  $('task-modal').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeModal();
      return;
    }
    trapFocus(event);
  });

  try {
    state.user = await apiRequest('/auth/me');
    await afterLogin();
  } catch (error) {
    if (error.status === 401) {
      showLoginView();
    } else {
      handleApiError(error);
      showLoginView();
    }
  }
}

boot();
