import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

test('platform API rejects other hotel admins and preserves hotel settings', { timeout: 20000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'hotel-platform-test-'));
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(dir, 'test.sqlite'), PLATFORM_OWNER_USER_ID: '1', DEFAULT_ADMIN_USERNAME: 'OwnerTest', DEFAULT_ADMIN_PASSWORD: 'owner-test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 8000);
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); });
      server.stdout.on('data', data => { if (String(data).includes('écoute')) { clearTimeout(timeout); resolve(); } });
    });
    const request = (url, options = {}) => fetch(`http://127.0.0.1:${port}${url}`, options);
    const login = async (username, password) => (await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })).json();
    const owner = await login('OwnerTest', 'owner-test-password');
    const headers = { 'Content-Type': 'application/json', 'x-access-token': owner.token };
    assert.equal((await request('/api/platform/overview')).status, 401);
    const overview = await request('/api/platform/overview', { headers });
    assert.equal(overview.status, 200);
    assert.equal(overview.headers.get('cache-control'), 'no-store');
    assert.equal((await overview.json()).hotel.name, 'Mon hôtel');
    assert.equal((await request('/api/admin/users', { method: 'POST', headers, body: JSON.stringify({ username: 'HotelManager', password: 'manager-test-password', role: 'admin' }) })).status, 201);
    const manager = await login('HotelManager', 'manager-test-password');
    assert.equal((await request('/api/platform/overview', { headers: { 'x-access-token': manager.token } })).status, 403);
    const access = await request('/api/platform/access', { headers: { 'x-access-token': manager.token } });
    assert.deepEqual(await access.json(), { allowed: false });
    const original = await (await request('/api/admin/settings', { headers })).json();
    const response = await request('/api/admin/settings', { method: 'PUT', headers, body: JSON.stringify({ ...original, hotelProfile: { name: 'Hôtel du Parc', department: 'Réception', timezone: 'Europe/Paris' } }) });
    const saved = await response.json();
    assert.equal(saved.hotelProfile.name, 'Hôtel du Parc');
    assert.equal(saved.quickTemplates.length, original.quickTemplates.length);
    const refreshed = await (await request('/api/platform/overview', { headers })).json();
    assert.equal(refreshed.hotel.name, 'Hôtel du Parc');
  } finally {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await stopped;
    await rm(dir, { recursive: true, force: true });
  }
});
