import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformOwner, requirePlatformOwner } from '../server/platformAccess.js';
import { sanitizeHotelProfile } from '../shared/hotelProfile.js';

test('platform ownership is explicit, active and never inherited by hotel admins', () => {
  const owner = { id: 7, role: 'admin', is_active: true };
  assert.equal(isPlatformOwner(owner, ''), false);
  assert.equal(isPlatformOwner(owner, '7'), true);
  assert.equal(isPlatformOwner({ ...owner, id: 8 }, '7'), false);
  assert.equal(isPlatformOwner({ ...owner, role: 'reception' }, '7'), false);
  assert.equal(isPlatformOwner({ ...owner, is_active: false }, '7'), false);
  assert.equal(isPlatformOwner(owner, '*'), false);
  assert.equal(isPlatformOwner(null, '7'), false);
});

test('forbidden platform access stops before route handler', () => {
  let called = false;
  let status;
  const res = { status(value) { status = value; return this; }, json() {} };
  requirePlatformOwner({ user: { id: -1, role: 'reception', is_active: true } }, res, () => { called = true; });
  assert.equal(status, 403);
  assert.equal(called, false);
});

test('hotel profile safely accepts legacy settings and rejects invalid timezones', () => {
  assert.deepEqual(sanitizeHotelProfile(null), { name: 'Mon hôtel', department: 'Réception', timezone: 'Europe/Paris' });
  assert.equal(sanitizeHotelProfile({ name: '  Hôtel du Parc  ', timezone: 'invalid/zone' }).name, 'Hôtel du Parc');
  assert.equal(sanitizeHotelProfile({ timezone: 'invalid/zone' }).timezone, 'Europe/Paris');
  assert.equal(sanitizeHotelProfile({ name: 'x'.repeat(100) }).name.length, 80);
});
