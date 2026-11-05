'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('./state');

test('điểm + trạng thái', () => {
  assert.deepStrictEqual(L.scoreOf('ĐIỂM: 8/10 | TỰ TIN: 85%\n✔ Task 1'), { score: 8, confidence: 85 });
  assert.strictEqual(L.scoreOf('không có'), null);
  assert.strictEqual(L.phaseOf('▶ Plan: 3 task').key, 'plan');
  assert.strictEqual(L.phaseOf('✎ Task 2: đã code').key, 'code');
  assert.strictEqual(L.phaseOf('').key, 'work');
});

test('dựng trạng thái văn phòng', () => {
  const s = L.buildState({
    runs: [{ name: 'run-cluster', display_title: 'issue-12 ubuntu-latest', status: 'in_progress', run_started_at: 't' }],
    open: [
      { number: 12, title: 'D02', body: '- [x] a\n- [ ] b', labels: [{ name: 'ci-run' }, { name: 'ci-running' }, { name: 'bot:ironman' }, { name: 'model:opus' }] },
      { number: 13, title: 'D03', body: 'Chờ: #12', labels: [{ name: 'ci-run' }, { name: 'bot:spiderman' }] },
      { number: 14, title: 'E05', body: '', labels: [{ name: 'ci-run' }, { name: 'bot:queenie' }] },
      { number: 3, title: 'iOS thử', body: '- [ ] a', labels: [{ name: 'ci-run' }, { name: 'ci-running' }] },
    ],
    lastComment: { 12: '✎ Task 1: đã code — model JSON' },
    closed: [{ number: 6, title: 'D00', labels: [{ name: 'bot:ironman' }], closed_at: 'x' }],
    closedReport: { 6: '**Runner**\nĐIỂM: 9/10 | TỰ TIN: 90%' },
  });
  const iron = s.bots.find(b => b.name === 'Iron Man');
  assert.strictEqual(iron.state, 'code');
  assert.deepStrictEqual(iron.jobs[0].progress, { done: 1, total: 2 });
  assert.strictEqual(iron.jobs[0].machine.os, 'ubuntu-latest');
  assert.strictEqual(iron.jobs[0].model, 'opus');
  assert.strictEqual(s.bots.find(b => b.name === 'Spider Man').state, 'idle');
  assert.deepStrictEqual([s.queue.waiting, s.queue.blocked, s.queue.ready], [2, 1, 1]);
  assert.strictEqual(s.bots.find(b => b.name === 'Captain Queenie').jobs[0].number, 3); // 3 % 3 = 0 → Queenie
  assert.deepStrictEqual(s.done[0], { number: 6, title: 'D00', url: undefined, closedAt: 'x', bot: 'Iron Man', score: 9, confidence: 90 });
});

const V = require('./vault');
test('két token: đúng mật khẩu mở được, sai thì không', async () => {
  const { blob } = await V.seal('admin', 'github_pat_ABC', '123456');
  assert.ok(!JSON.stringify(blob).includes('github_pat_ABC'));
  assert.strictEqual((await V.unlock(blob, 'admin', '123456')).token, 'github_pat_ABC');
  await assert.rejects(V.unlock(blob, 'admin', '123457'));
  await assert.rejects(V.unlock(blob, 'root', '123456'));
});
