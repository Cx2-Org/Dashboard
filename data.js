// Lấy dữ liệu từ GitHub ngay trong trình duyệt bằng token chỉ-đọc của người xem → State.buildState.
(function (root) {
'use strict';
const REPO = 'nguyenphp/vibecut', RUNNER = 'Cx2-Org/Runner';

function client(token) {
  return async url => {
    const r = await fetch(`https://api.github.com${url}`, { headers: { Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
    if (r.status === 401) throw Object.assign(new Error('Token hết hạn hoặc sai'), { auth: true });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json();
  };
}

async function lastMatching(gh, it, re) {
  const page = Math.max(1, Math.ceil((it.comments || 0) / 100));
  const cs = await gh(`/repos/${REPO}/issues/${it.number}/comments?per_page=100&page=${page}`);
  return (cs.filter(c => re.test(c.body || '')).pop() || {}).body || '';
}

let cache = { closed: [], closedReport: {}, at: 0 };
async function load(token) {
  const gh = client(token);
  const [prog, queued, open] = await Promise.all([
    gh(`/repos/${RUNNER}/actions/runs?status=in_progress&per_page=50`),
    gh(`/repos/${RUNNER}/actions/runs?status=queued&per_page=50`),
    gh(`/repos/${REPO}/issues?labels=ci-run&state=open&per_page=100`)]);
  const issues = open.filter(i => !i.pull_request);
  const running = issues.filter(i => i.labels.some(l => l.name === 'ci-running'));
  const lastComment = {};
  await Promise.all(running.map(async it => {
    lastComment[it.number] = await lastMatching(gh, it, /^(▶|✎|✔|BỎ QUA|CẦN-MODEL-MẠNH|Runner:)/);
  }));
  if (Date.now() - cache.at > 120e3) { // việc đã xong: 2 phút đọc 1 lần cho đỡ tốn lượt API
    const since = new Date(Date.now() - 48 * 3600e3).toISOString();
    const closed = (await gh(`/repos/${REPO}/issues?labels=ci-run&state=closed&since=${since}&per_page=15&sort=updated`))
      .filter(i => !i.pull_request);
    const rep = {};
    await Promise.all(closed.map(async it => { rep[it.number] = await lastMatching(gh, it, /^\*\*Runner\*\*/); }));
    cache = { closed, closedReport: rep, at: Date.now() };
  }
  return root.State.buildState({ runs: [...prog.workflow_runs, ...queued.workflow_runs], open: issues, lastComment,
    closed: cache.closed, closedReport: cache.closedReport });
}

root.Data = { load };
})(window);
