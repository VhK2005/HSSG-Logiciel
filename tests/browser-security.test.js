import test from 'node:test';
import assert from 'node:assert/strict';

test('volatile cloud snapshots are removed from disk and stay in memory', async () => {
  const disk = new Map([['cloud-db', 'legacy-sensitive-state']]);
  globalThis.window = {localStorage:{getItem:k=>disk.get(k)??null, setItem:(k,v)=>disk.set(k,v), removeItem:k=>disk.delete(k)}};
  const storage = await import('../src/safeStorage.js');
  storage.useMemoryStorage('cloud-db');
  assert.equal(disk.has('cloud-db'), false);
  storage.writeStorage('cloud-db', 'fresh-state');
  assert.equal(storage.readStorage('cloud-db'), 'fresh-state');
  assert.equal(disk.has('cloud-db'), false);
  storage.removeStorage('cloud-db');
  assert.equal(storage.readStorage('cloud-db'), null);
});

test('startup errors do not interpret HTML or expose raw messages', async () => {
  const root = {replaceChildren(panel){this.panel=panel;}};
  globalThis.document = {getElementById:()=>root, createElement:tag=>({tag,children:[],append(...items){this.children.push(...items);},addEventListener(){}})};
  const {renderStartupError} = await import('../src/startupError.js');
  renderStartupError(new Error('<img src=x onerror=alert(1)> secret'));
  assert.equal(root.panel.children.length, 3);
  assert.equal(root.panel.children.some(node=>String(node.textContent).includes('secret')), false);
  assert.equal('innerHTML' in root, false);
});
