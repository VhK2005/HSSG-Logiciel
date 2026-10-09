import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/staticApi.js';
import { writeStorage } from '../src/safeStorage.js';

test('backup excludes credentials, CSV neutralizes formulas and J-1 preserves state', async () => {
  const session = api.loginUser('Admin', 'admin');
  writeStorage('overviewReceptionAccessToken', session.token);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  const task = api.createTask({title:'=1+1', description:'test', due_date:date, status:'En attente', priority:'Normale', category:'Client'});
  assert.equal(api.fetchTasks().find(t=>t.id===task.id).status, 'En attente');
  const backup = JSON.parse(await api.downloadAdminFile('/api/admin/backup').blob.text());
  assert.equal(backup.users.some(u=>'password' in u), false);
  assert.deepEqual(backup.sessions, []);
  const csv = await api.downloadAdminFile('/api/admin/export?format=csv').blob.text();
  assert.ok(csv.includes("'=1+1"));
});
