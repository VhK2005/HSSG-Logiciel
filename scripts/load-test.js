const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'http://localhost:3001';
const ADMIN_USERNAME = process.env.LOAD_TEST_ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.LOAD_TEST_ADMIN_PASSWORD || 'admin';
const TASKS_PER_RECEPTION = Number(process.env.LOAD_TEST_TASKS_PER_RECEPTION || 45);
const DIRECTOR_POLLS = Number(process.env.LOAD_TEST_DIRECTOR_POLLS || 90);
const RECEPTION_CONCURRENCY = Number(process.env.LOAD_TEST_RECEPTION_CONCURRENCY || 8);
const CLEANUP = process.env.LOAD_TEST_CLEANUP !== 'false';

const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const titlePrefix = `[LOADTEST-${runId}]`;
const metrics = [];
const createdIds = new Set();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const index = Math.ceil(values.length * ratio) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function dueDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function request(actor, token, method, path, body) {
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'x-access-token': token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    status = res.status;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    metrics.push({
      actor,
      method,
      path,
      status,
      ok: res.ok,
      ms: performance.now() - started
    });

    if (!res.ok) {
      const error = new Error(data?.message || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    return data;
  } catch (error) {
    metrics.push({
      actor,
      method,
      path,
      status,
      ok: false,
      ms: performance.now() - started,
      error: error.message
    });
    throw error;
  }
}

async function login(username, password, actor) {
  return request(actor, null, 'POST', '/api/auth/login', { username, password });
}

async function runPool(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await worker(item);
    }
  });

  await Promise.all(workers);
}

async function createReception(adminToken, suffix) {
  const username = `Reception-Load-${suffix}`;
  const password = 'load-test-1234';
  const users = await request('directeur', adminToken, 'GET', '/api/admin/users');

  if (!users.some((user) => user.username === username)) {
    await request('directeur', adminToken, 'POST', '/api/admin/users', {
      username,
      password,
      role: 'reception'
    });
  }

  const session = await login(username, password, username);
  return {
    username,
    token: session.token
  };
}

function buildTask(user, index) {
  const categories = ['Client', 'Reservation', 'Menage', 'Bagagerie'];
  const realCategories = ['Client', 'Réservation', 'Ménage', 'Bagagerie'];
  const priorities = ['Normale', 'Importante', 'Urgente'];
  const statuses = ['À faire', 'En cours', 'En attente'];
  const categoryIndex = index % realCategories.length;

  return {
    title: `${titlePrefix} ${categories[categoryIndex]} ${user.username} #${index + 1}`,
    description: `Scenario charge: consigne creee par ${user.username}, action ${index + 1}.`,
    due_date: dueDate((index % 9) - 2),
    priority: priorities[index % priorities.length],
    category: realCategories[categoryIndex],
    status: statuses[index % statuses.length]
  };
}

async function receptionWork(user) {
  const indexes = Array.from({ length: TASKS_PER_RECEPTION }, (_, index) => index);

  await runPool(indexes, RECEPTION_CONCURRENCY, async (index) => {
    const task = await request(user.username, user.token, 'POST', '/api/tasks', buildTask(user, index));
    createdIds.add(task.id);

    if (index % 2 === 0) {
      await request(user.username, user.token, 'PUT', `/api/tasks/${task.id}`, {
        status: 'En cours'
      });
    }

    if (index % 3 === 0) {
      await request(user.username, user.token, 'PUT', `/api/tasks/${task.id}`, {
        status: 'En attente'
      });
    }

    if (index % 4 === 0) {
      await request(user.username, user.token, 'PUT', `/api/tasks/${task.id}`, {
        priority: 'Urgente'
      });
    }

    if (index % 5 === 0) {
      await request(user.username, user.token, 'GET', `/api/tasks/${task.id}/history`);
    }

    if (index % 6 === 0) {
      await request(user.username, user.token, 'PUT', `/api/tasks/${task.id}`, {
        status: 'Fait'
      });
    }

    if (index % 7 === 0) {
      await request(user.username, user.token, 'GET', '/api/tasks');
    }
  });
}

async function directorWork(adminToken) {
  const paths = [
    '/api/tasks',
    '/api/tasks/archived',
    '/api/admin/contribution-stats',
    '/api/admin/users',
    '/api/admin/settings'
  ];

  for (let index = 0; index < DIRECTOR_POLLS; index += 1) {
    await request('directeur', adminToken, 'GET', paths[index % paths.length]);
    await delay(12);
  }
}

async function cleanup(adminToken) {
  if (!CLEANUP) return { deleted: 0 };

  const active = await request('cleanup', adminToken, 'GET', '/api/tasks');
  const archived = await request('cleanup', adminToken, 'GET', '/api/tasks/archived');
  const targets = [...active, ...archived].filter(
    (task) => task.title?.startsWith(titlePrefix) || createdIds.has(task.id)
  );

  await runPool(targets, 10, async (task) => {
    await request('cleanup', adminToken, 'DELETE', `/api/tasks/${task.id}`);
  });

  return { deleted: targets.length };
}

function summarize(durationMs, cleanupResult) {
  const total = metrics.length;
  const failed = metrics.filter((item) => !item.ok);
  const ok = total - failed.length;
  const durations = metrics.map((item) => item.ms).sort((a, b) => a - b);
  const byActor = metrics.reduce((acc, item) => {
    acc[item.actor] = (acc[item.actor] || 0) + 1;
    return acc;
  }, {});
  const byStatus = metrics.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify(
    {
      runId,
      baseUrl: BASE_URL,
      scenario: {
        director: 1,
        receptionists: 2,
        tasksPerReceptionist: TASKS_PER_RECEPTION,
        receptionistConcurrency: RECEPTION_CONCURRENCY,
        directorPolls: DIRECTOR_POLLS
      },
      requests: {
        total,
        ok,
        failed: failed.length,
        byActor,
        byStatus
      },
      latencyMs: {
        min: Number((durations[0] || 0).toFixed(1)),
        p50: Number(percentile(durations, 0.5).toFixed(1)),
        p95: Number(percentile(durations, 0.95).toFixed(1)),
        max: Number((durations[durations.length - 1] || 0).toFixed(1))
      },
      data: {
        createdTasks: createdIds.size,
        deletedTestTasks: cleanupResult.deleted
      },
      durationMs: Number(durationMs.toFixed(1)),
      failures: failed.slice(0, 8).map((item) => ({
        actor: item.actor,
        method: item.method,
        path: item.path,
        status: item.status,
        error: item.error
      }))
    },
    null,
    2
  ));
}

async function main() {
  const started = performance.now();
  let adminToken = '';
  let cleanupResult = { deleted: 0 };

  try {
    await request('systeme', null, 'GET', '/api/health');
    const admin = await login(ADMIN_USERNAME, ADMIN_PASSWORD, 'directeur');
    adminToken = admin.token;

    const receptionA = await createReception(adminToken, 'A');
    const receptionB = await createReception(adminToken, 'B');

    await Promise.all([
      directorWork(adminToken),
      receptionWork(receptionA),
      receptionWork(receptionB)
    ]);
  } finally {
    if (adminToken) {
      cleanupResult = await cleanup(adminToken);
    }
    summarize(performance.now() - started, cleanupResult);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
