/* Leadership interface (index.html): read-only views built to run the all-hands. */
'use strict';
(() => {
const { $, $$, esc } = A;
let D, q = '', hf = '', sort = 'health';
const ORDER = { red: 0, amber: 1, green: 2, paused: 3, done: 4 };
const ROUTES = [['overview', 'Overview'], ['projects', 'Projects'], ['metrics', 'Metrics'], ['people', 'People'], ['roadmap', 'Roadmap']];

A.boot(d => { D = d; window.addEventListener('hashchange', draw); draw(); });

function nav(cur) {
  $('#nav').innerHTML = ROUTES.map(([k, v]) => `<a href="#${k}"${cur === k ? ' aria-current="page"' : ''}>${v}</a>`).join('') +
    `<button id="present">Present</button><a class="switch" href="manage.html">Workbench</a><button id="so">Sign out</button>`;
  $('#so').onclick = A.signOut; $('#present').onclick = present;
}
function draw() {
  const h = location.hash.slice(1) || 'overview', [r, id] = h.split('/');
  nav(r === 'p' ? 'projects' : r);
  const app = $('#app');
  app.innerHTML = r === 'p' ? project(id) : ({ overview, projects, metrics, people, roadmap }[r] || overview)();
  if (r === 'projects') bindProjects();
  if (r === 'overview' || r === 'metrics') $$('[data-m]').forEach(b => b.onclick = () => { location.hash = 'metrics'; });
  window.scrollTo(0, 0);
}
const live = () => D.active.filter(p => p.status !== 'completed');
const byHealth = ps => [...ps].sort((a, b) => ORDER[a.healthNow] - ORDER[b.healthNow] || a.name.localeCompare(b.name));
const counts = ps => ps.reduce((c, p) => (c[p.healthNow] = (c[p.healthNow] || 0) + 1, c), {});
const plink = id => { const p = D.P.get(id) || D.P.get(D.alias?.[id]); return p ? `<a href="#p/${esc(p.id)}">${esc(p.name)}</a>` : ''; };

/* ---------- events ---------- */
const FIELD = { status: 'status', owner: 'owner', assignee: 'owner', due: 'due date', date: 'date', done: 'done', current: 'value', target: 'target', archived: 'archived' };
const val = (f, v) => v == null || v === '' ? 'none' : f === 'status' ? (A.ST[v] || A.TS[v] || v) : (f === 'due' || f === 'date') ? A.fmtDate(v) : f === 'done' ? (v ? 'done' : 'not done') : String(v);
function evText(e) {
  const kind = { p: 'Project', t: 'Task', m: 'Milestone', k: 'Metric' }[e.key[0]];
  if (e.type === 'added') return `${kind} added: ${esc(e.label)}`;
  if (e.type === 'removed') return `${kind} removed: ${esc(e.label)}`;
  return `${esc(e.label)}: ${esc(FIELD[e.field] || e.field)} ${esc(val(e.field, e.from))} → <b>${esc(val(e.field, e.to))}</b>`;
}
const isWin = e => e.type === 'changed' && ((e.field === 'status' && (e.to === 'done' || e.to === 'completed')) || (e.field === 'done' && e.to === true));
function winsSince(since) {
  const ev = D.history.filter(e => e.at >= since && isWin(e)), keys = new Set(ev.map(e => e.key));
  D.projects.forEach(p => p.tasks.forEach(t => { if (t.status === 'done' && (t.seen || '') >= since && !keys.has('t:' + t.id)) ev.push({ at: t.seen, key: 't:' + t.id, p: p.id, label: t.text, type: 'changed', field: 'status', to: 'done' }); }));
  return ev.sort((a, b) => b.at.localeCompare(a.at));
}
function upcoming(days) {
  const t0 = A.today(), end = A.addDays(t0, days), r = [];
  D.active.forEach(p => {
    p.milestones.filter(m => !m.done && m.date && m.date >= t0 && m.date <= end).forEach(m => r.push({ d: m.date, k: 'Milestone', x: m.title, p, w: p.owner }));
    p.open.filter(t => t.due && t.due >= t0 && t.due <= end).forEach(t => r.push({ d: t.due, k: 'Task', x: t.text, p, w: t.assignee }));
  });
  return r.sort((a, b) => a.d.localeCompare(b.d) || (a.k === 'Milestone' ? -1 : 1));
}

/* ---------- overview ---------- */
function overview() {
  const ps = byHealth(live()), c = counts(ps), t0 = A.today();
  const head = ps.length ? `${ps.length} active project${ps.length === 1 ? '' : 's'}: ${c.green || 0} on track, ${c.amber || 0} at risk, ${c.red || 0} off track.` : 'No active projects yet.';
  const attention = ps.filter(p => p.healthNow === 'red' || p.healthNow === 'amber');
  const agentN = D.decisions.filter(d => d.state === 'applied' || d.state === 'approved').length;
  const up = upcoming(30), wins = winsSince(A.addDays(t0, -30)).slice(0, 10), recent = D.history.filter(e => e.at >= A.addDays(t0, -14)).slice(-14).reverse();
  return `<h2 class="page">${esc(D.settings.org)} portfolio</h2><p class="lede">Updated ${esc(A.fmtDate(D.generated.slice(0, 10)))} from ${D.meetings.length} meeting${D.meetings.length === 1 ? '' : 's'}, ${D.ops_applied.length} saved edit${D.ops_applied.length === 1 ? '' : 's'} and ${agentN} agent change${agentN === 1 ? '' : 's'}.</p>
  <p class="headline">${esc(head)}</p>
  <div class="strip" role="list" aria-label="Projects by health">${ps.map(p => `<a role="listitem" class="h-${p.healthNow}" style="flex:1" href="#p/${esc(p.id)}" title="${esc(p.name)}: ${esc(A.HEALTH[p.healthNow])}"><span hidden>${esc(p.name)}</span></a>`).join('')}</div>
  <div class="legend">${['red', 'amber', 'green', 'paused'].filter(h => c[h]).map(h => `<span class="pill h-${h}"><i></i>${A.HEALTH[h]}<b class="num">&nbsp;${c[h]}</b></span>`).join('')}</div>
  <h3 class="sec">Company metrics <span class="mute">${D.metrics.length ? 'progress from baseline to target' : ''}</span></h3>${metricCards(D.metrics.slice(0, 6))}
  <div class="cols">
   <section><h3 class="sec">Needs attention</h3>${attention.length ? `<ul class="plain">${attention.map(p => `<li>${A.pill(p.healthNow)} ${plink(p.id)}<div class="small mute">${esc(p.reasons.join('; ') || 'Marked at risk by a person')}${p.owner ? ' · Owner ' + esc(p.owner) : ''}</div></li>`).join('')}</ul>` : '<p class="empty">Nothing is off track or at risk.</p>'}</section>
   <section><h3 class="sec">Next 30 days</h3>${up.length ? `<ul class="plain">${up.slice(0, 12).map(x => `<li><span class="num">${esc(A.fmtDate(x.d))}</span> · ${x.k === 'Milestone' ? '<b>' + esc(x.x) + '</b>' : esc(x.x)}<div class="small mute">${plink(x.p.id)}${x.w ? ' · ' + esc(x.w) : ''}</div></li>`).join('')}</ul>` : '<p class="empty">No dated milestones or tasks in the next 30 days.</p>'}</section>
  </div>
  <div class="cols">
   <section><h3 class="sec">Delivered in the last 30 days</h3>${wins.length ? `<ul class="plain">${wins.map(e => `<li>${esc(e.label)}<div class="small mute">${plink(e.p)} · ${esc(A.fmtDate(e.at))}</div></li>`).join('')}</ul>` : '<p class="empty">No completed work recorded yet.</p>'}</section>
   <section><h3 class="sec">Recent changes</h3>${recent.length ? `<ul class="plain">${recent.map(e => `<li>${evText(e)}<div class="small mute">${e.p ? plink(e.p) + ' · ' : ''}${esc(A.fmtDate(e.at))}${e.src ? ' · ' + esc(A.srcLabel(e.src).toLowerCase()) : ''}</div></li>`).join('')}</ul>` : '<p class="empty">Changes appear here after the next publish.</p>'}</section>
  </div>`;
}
function metricCards(ms) {
  if (!D.metrics.length) return '<p class="empty">No company metrics yet. Add them in the Workbench under Metrics, then tie each project to the metrics it moves.</p>';
  return `<div class="cards">${ms.map(m => { const pc = A.metricPct(m), n = D.metricLinks.get(m.id).length, tr = trend(m);
    return `<div class="mcard"><h4>${esc(m.name)}</h4><div class="big num">${esc(A.fmtNum(m.current, m.unit))}</div>
    <div class="small mute">Target ${esc(A.fmtNum(m.target, m.unit))}${m.period ? ' by ' + esc(m.period) : ''}${m.owner ? ' · ' + esc(m.owner) : ''}</div>
    ${pc == null ? '' : `<div class="gauge" role="img" aria-label="${Math.round(pc * 100)}% of the way to target"><span style="width:${pc * 100}%"></span></div>`}
    ${tr}<div class="small"><a href="#metrics">${n} project${n === 1 ? '' : 's'}</a> move this metric</div></div>`; }).join('')}</div>`;
}
function trend(m) {
  const pts = D.history.filter(e => e.key === 'k:' + m.id && e.field === 'current' && e.to != null).map(e => +e.to);
  if (pts.length < 2) return '';
  const lo = Math.min(...pts), hi = Math.max(...pts), w = 120, h = 26, x = i => i / (pts.length - 1) * w, y = v => h - 2 - (hi === lo ? .5 : (v - lo) / (hi - lo)) * (h - 4);
  return `<svg width="${w}" height="${h}" role="img" aria-label="Recent values"><polyline fill="none" stroke="var(--metric)" stroke-width="2" points="${pts.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/></svg>`;
}

/* ---------- projects ---------- */
function projects() {
  const L = D.active.filter(p => (!hf || p.healthNow === hf) && (!q || JSON.stringify([p.name, p.owner, p.description, p.team, p.tasks.map(t => [t.text, t.assignee])]).toLowerCase().includes(q.toLowerCase())));
  const S = { health: (a, b) => ORDER[a.healthNow] - ORDER[b.healthNow], name: (a, b) => a.name.localeCompare(b.name), progress: (a, b) => b.progress - a.progress, next: (a, b) => (a.nextMilestone?.date || '9').localeCompare(b.nextMilestone?.date || '9') };
  L.sort((a, b) => S[sort](a, b) || a.name.localeCompare(b.name));
  return `<h2 class="page">Projects</h2><p class="lede">Every active project, its health, owner and progress. Select one for people, work breakdown, backlog and timeline.</p>
  <div class="bar"><input type="search" id="q" placeholder="Search projects, people or tasks" value="${esc(q)}" aria-label="Search">
  <select id="hf" aria-label="Health"><option value="">All health</option>${Object.entries(A.HEALTH).map(([k, v]) => `<option value="${k}"${hf === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
  <select id="sort" aria-label="Sort">${[['health', 'Worst health first'], ['next', 'Next milestone'], ['progress', 'Most complete'], ['name', 'Name']].map(([k, v]) => `<option value="${k}"${sort === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="cards">${L.map(card).join('') || '<p class="empty">No projects match. Clear the search or filter.</p>'}</div>`;
}
const card = p => `<a class="card h-${p.healthNow}" href="#p/${esc(p.id)}"><h4>${esc(p.name)}</h4>${A.pill(p.healthNow)} ${A.status(p.status)}
  <div class="meta"><span>Owner ${A.who(p.owner)}</span><span>${A.progress(p.progress)}${p.done}/${p.tasks.length} tasks</span>${p.nextMilestone ? `<span>Next: ${esc(p.nextMilestone.title)}, ${esc(A.fmtDate(p.nextMilestone.date))}</span>` : ''}</div>
  ${p.metrics.length ? `<div class="chips" style="margin-top:8px">${p.metrics.map(l => D.K.get(l.metric)).filter(Boolean).map(m => `<span class="chip metric">${esc(m.name)}</span>`).join('')}</div>` : ''}</a>`;
function bindProjects() {
  const i = $('#q'); i.oninput = e => { q = e.target.value; const pos = e.target.selectionStart; draw(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#hf').onchange = e => { hf = e.target.value; draw(); }; $('#sort').onchange = e => { sort = e.target.value; draw(); };
}

function project(id) {
  const p = D.P.get(id) || D.P.get(D.alias?.[id]);
  if (!p) return '<p class="empty">This project no longer exists. It may have been merged or archived. <a href="#projects">Back to projects</a></p>';
  const F = D.settings.features, ws = groupWS(p.tasks), backlog = [...p.open].sort((a, b) => (a.priority || 5) - (b.priority || 5) || a.level - b.level || (a.due || '9').localeCompare(b.due || '9'));
  const roles = (D.people.filter(x => x.roles.has(p.id)));
  const meetings = p.meetings.map(m => D.MT.get(m)).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  const ev = D.history.filter(e => e.p === p.id).slice(-12).reverse();
  const deps = p.depends_on.map(plink).filter(Boolean), dependents = D.active.filter(x => x.depends_on.includes(p.id));
  return `<p class="small"><a href="#projects">Projects</a></p><h2 class="page">${esc(p.name)}</h2>
  <p>${A.pill(p.healthNow)} ${A.status(p.status)} ${p.health ? '<span class="small mute">health set by a person</span>' : ''}</p>
  ${p.description ? `<p class="lede">${esc(p.description)}</p>` : ''}
  ${p.reasons.length ? `<div class="notice">${esc(p.reasons.join('; '))}.</div>` : ''}
  <div class="cols"><div class="panel"><dl class="kv"><dt>Owner</dt><dd>${A.who(p.owner)}</dd>${p.sponsor ? `<dt>Sponsor</dt><dd>${esc(p.sponsor)}</dd>` : ''}<dt>Progress</dt><dd>${A.progress(p.progress, true)} <span class="small mute">${p.done} of ${p.tasks.length} tasks</span></dd>
   <dt>Next milestone</dt><dd>${p.nextMilestone ? esc(p.nextMilestone.title) + ', ' + esc(A.fmtDate(p.nextMilestone.date)) : '<span class="mute">None scheduled</span>'}</dd>
   ${F.waterfall && p.phase ? `<dt>Phase</dt><dd>${esc(p.phase)}</dd>` : ''}${p.target ? `<dt>Target date</dt><dd>${esc(A.fmtDate(p.target))}</dd>` : ''}
   <dt>Last discussed</dt><dd>${esc(A.fmtDate(p.updated)) || '<span class="mute">Not in a meeting yet</span>'}</dd>
   ${deps.length ? `<dt>Depends on</dt><dd>${deps.join(', ')}</dd>` : ''}${dependents.length ? `<dt>Needed by</dt><dd>${dependents.map(x => plink(x.id)).join(', ')}</dd>` : ''}</dl></div>
   <div class="panel"><h4 style="margin:0 0 8px">How it moves company metrics</h4>${p.metrics.length ? `<ul class="plain">${p.metrics.map(l => { const m = D.K.get(l.metric); return m ? `<li><span class="chip metric">${esc(m.name)}</span> <span class="small">${esc(A.fmtNum(m.current, m.unit))} of ${esc(A.fmtNum(m.target, m.unit))}</span><div class="small mute">${esc(l.how || 'No explanation recorded')}</div></li>` : ''; }).join('')}</ul>` : `<p class="empty">Not tied to a company metric yet.${p.metrics_mentioned.length ? ' Meetings mentioned: ' + esc(p.metrics_mentioned.join(', ')) + '.' : ''}</p>`}</div></div>
  <h3 class="sec">People <span class="mute">who is involved and how</span></h3>
  ${roles.length ? `<div class="scroll"><table class="t"><tr><th>Person</th><th>Role</th><th>Open tasks here</th></tr>${roles.map(x => { const ts = x.tasks.filter(t => t._p === p.id); return `<tr><td>${esc(x.name)}</td><td>${esc(x.roles.get(p.id))}</td><td>${ts.length ? ts.map(t => `${esc(t.text)}${t.due ? ` <span class="small ${t.overdue ? 'late' : 'mute'}">${esc(A.fmtDate(t.due))}</span>` : ''}`).join('<br>') : '<span class="mute">None</span>'}</td></tr>`; }).join('')}</table></div>` : '<p class="empty">No people recorded yet.</p>'}
  <h3 class="sec">Work breakdown <span class="mute">${ws.length} workstream${ws.length === 1 ? '' : 's'}, ${p.tasks.length} tasks</span></h3>
  ${p.tasks.length ? ws.map(([w, ts]) => `<details class="ws" open><summary>${esc(w)} <span class="mute small">${ts.filter(t => t.status === 'done').length}/${ts.length} done</span></summary><ul>${ts.map(t => `<li class="${t.status === 'done' ? 'done-t' : ''}">${esc(t.text)} <span class="small mute">${esc(t.assignee || 'Unassigned')}${t.due ? ', ' : ''}</span>${t.due ? `<span class="small ${t.overdue ? 'late' : 'mute'}">${esc(A.fmtDate(t.due))}</span>` : ''}${t.status === 'blocked' ? ' <span class="small late">blocked</span>' : ''}${F.agile && t.points ? ` <span class="chip">${esc(t.points)} pts</span>` : ''}</li>`).join('')}</ul></details>`).join('') : '<p class="empty">No tasks recorded yet.</p>'}
  <h3 class="sec">Backlog <span class="mute">open work in priority and sequence order</span></h3>
  ${backlog.length ? `<div class="scroll"><table class="t"><tr><th>#</th><th>Task</th><th>Owner</th><th>Due</th><th>Waits on</th>${F.agile ? '<th>Sprint</th><th>Points</th>' : ''}</tr>${backlog.map(t => `<tr><td class="mute">${t.priority ? 'P' + t.priority : ''}</td><td>${esc(t.text)}${t.status === 'blocked' ? ' <span class="small late">blocked</span>' : ''}</td><td>${A.who(t.assignee)}</td><td class="${t.overdue ? 'late' : ''}">${esc(A.fmtDate(t.due))}</td><td class="small">${t.blockers.map(b => esc(b.text)).join('<br>')}</td>${F.agile ? `<td>${esc(t.sprint || '')}</td><td>${esc(t.points ?? '')}</td>` : ''}</tr>`).join('')}</table></div>` : '<p class="empty">No open tasks.</p>'}
  <h3 class="sec">Sequence <span class="mute">what can start now and what waits on what</span></h3>${A.seqGraph(p.tasks)}
  <h3 class="sec">Timeline</h3>${A.gantt(p.tasks.filter(t => t.due || t.start).map(t => ({ label: t.text, sub: t.assignee || '', start: t.start || (t.estimate && t.due ? A.addDays(t.due, -Math.ceil(t.estimate)) : t.due), end: t.due || t.start, cls: (t.crit && F.waterfall ? 'crit ' : '') + (t.status === 'done' ? 'done' : '') })).concat(p.milestones.filter(m => m.date).length ? [{ label: 'Milestones', ms: p.milestones }] : []), { label: 'Project timeline' })}
  <div class="cols">
   <section><h3 class="sec">Risks</h3>${list(p.risks)}</section>
   <section><h3 class="sec">Assumptions</h3>${list(p.assumptions)}</section>
   <section><h3 class="sec">Dependencies mentioned</h3>${list(p.dependencies)}</section>
  </div>
  <div class="cols"><section><h3 class="sec">Recent changes</h3>${ev.length ? `<ul class="plain">${ev.map(e => `<li>${evText(e)}<div class="small mute">${esc(A.fmtDate(e.at))}${e.src ? ' · ' + esc(A.srcLabel(e.src).toLowerCase()) : ''}</div></li>`).join('')}</ul>` : '<p class="empty">No changes recorded yet.</p>'}</section>
  <section><h3 class="sec">Meetings</h3>${meetings.length ? `<ul class="plain">${meetings.map(m => `<li><b>${esc(A.fmtDate(m.date))}</b> <span class="small mute">${esc(m.file)}</span><div class="small">${esc(m.summary)}</div></li>`).join('')}</ul>` : '<p class="empty">Not discussed in an ingested meeting.</p>'}</section></div>
  <p><a href="manage.html#work/${esc(p.id)}">Edit this project in the Workbench</a></p>`;
}
const list = a => a.length ? `<ul class="plain">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="empty">None recorded.</p>';
function groupWS(ts) { const m = new Map(); ts.forEach(t => { const k = t.workstream || 'General'; if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
  return [...m.entries()].sort((a, b) => (a[0] === 'General') - (b[0] === 'General') || a[0].localeCompare(b[0])); }

/* ---------- metrics ---------- */
function metrics() {
  const untied = live().filter(p => !p.metrics.some(l => D.K.has(l.metric)));
  return `<h2 class="page">Company metrics</h2><p class="lede">Each line connects a metric to a project that moves it. Line colour is the project's health.</p>
  ${A.metricMap(D)}
  ${D.metrics.map(m => { const ls = D.metricLinks.get(m.id); return `<h3 class="sec">${esc(m.name)} <span class="mute">${esc(A.fmtNum(m.current, m.unit))} of ${esc(A.fmtNum(m.target, m.unit))}${m.owner ? ', owned by ' + esc(m.owner) : ''}</span></h3>
    ${m.description ? `<p class="lede">${esc(m.description)}</p>` : ''}${ls.length ? `<div class="scroll"><table class="t"><tr><th>Project</th><th>Health</th><th>How it moves this metric</th><th>Progress</th></tr>${ls.map(({ p, how }) => `<tr><td>${plink(p.id)}</td><td>${A.pill(p.healthNow)}</td><td>${esc(how || '')}</td><td>${A.progress(p.progress, true)}</td></tr>`).join('')}</table></div>` : '<p class="empty">No project is tied to this metric yet.</p>'}`; }).join('')}
  ${untied.length ? `<h3 class="sec">Not tied to a metric <span class="mute">${untied.length} active project${untied.length === 1 ? '' : 's'}</span></h3><div class="chips">${untied.map(p => `<a class="chip" href="#p/${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div>` : ''}`;
}

/* ---------- people ---------- */
function people() {
  const ps = byHealth(live()), people = D.people.filter(x => x.roles.size), max = Math.max(1, ...people.map(x => x.tasks.length));
  if (!people.length) return '<h2 class="page">People</h2><p class="empty">No people recorded yet.</p>';
  return `<h2 class="page">People</h2><p class="lede">Who is involved in each project and how. Filled cells mark project owners; the bar shows open tasks.</p>
  <div class="scroll"><table class="t matrix"><tr><th>Person</th><th>Open tasks</th>${ps.map(p => `<th class="rot"><div><a href="#p/${esc(p.id)}">${esc(p.name.slice(0, 28))}</a></div></th>`).join('')}</tr>
  ${people.map(x => `<tr><td>${esc(x.name)}</td><td class="num"><span class="load" style="width:${Math.round(x.tasks.length / max * 60)}px"></span>${x.tasks.length}${x.tasks.some(t => t.overdue) ? ` <span class="small late">${x.tasks.filter(t => t.overdue).length} late</span>` : ''}</td>${ps.map(p => { const r = x.roles.get(p.id); return `<td class="cell">${r ? `<span class="${r === 'Owner' ? 'own' : ''}" title="${esc(x.name)}: ${esc(r)} on ${esc(p.name)}">${esc(r)}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</table></div>`;
}

/* ---------- roadmap ---------- */
function roadmap() {
  const ps = byHealth(live());
  return `<h2 class="page">Roadmap</h2><p class="lede">Each bar runs from a project's start (or first mention) to its target date (or latest dated work). Diamonds are milestones; the dashed line is today.</p>
  ${A.gantt(ps.map(p => ({ label: p.name, sub: (A.HEALTH[p.healthNow] + (p.owner ? ', ' + p.owner : '')), start: p.spanStart, end: p.spanEnd, cls: 'h-' + p.healthNow, ms: p.milestones, href: '#p/' + p.id })), { label: 'Portfolio roadmap' })}`;
}

/* ---------- present mode: drives the all-hands ---------- */
function present() {
  const since = localStorage.getItem('aurora.since') || A.addDays(A.today(), -7);
  const slides = buildSlides(since);
  let i = 0;
  const deck = document.createElement('div'); deck.id = 'deck'; deck.setAttribute('role', 'dialog'); deck.setAttribute('aria-label', 'All-hands presentation');
  document.body.append(deck);
  const show = () => {
    deck.innerHTML = `<div class="slide">${slides[i]}</div><div class="ctrl"><span><button id="dx">Exit</button> <label class="small mute">Changes since <input type="date" id="since" value="${esc(since)}"></label></span>
    <span class="num mute">${i + 1} / ${slides.length}</span><span><button id="dp" ${i ? '' : 'disabled'}>Previous</button> <button class="go" id="dn" ${i < slides.length - 1 ? '' : 'disabled'}>Next</button> <button id="fs">Full screen</button></span></div>`;
    $('#dx').onclick = close; $('#dp').onclick = () => go(-1); $('#dn').onclick = () => go(1);
    $('#fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : deck.requestFullscreen?.();
    $('#since').onchange = e => { localStorage.setItem('aurora.since', e.target.value); close(); present(); };
  };
  const go = d => { i = Math.max(0, Math.min(slides.length - 1, i + d)); show(); };
  const key = e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1); if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', key); if (document.fullscreenElement) document.exitFullscreen(); deck.remove(); };
  document.addEventListener('keydown', key); show(); $('#dn')?.focus();
}
function buildSlides(since) {
  const ps = byHealth(live()), c = counts(ps), wins = winsSince(since), t0 = A.today();
  const moved = D.history.filter(e => e.at >= since && e.key[0] === 'p' && e.field === 'status');
  const newP = D.history.filter(e => e.at >= since && e.key[0] === 'p' && e.type === 'added');
  const attention = ps.filter(p => p.healthNow === 'red' || p.healthNow === 'amber');
  const up = upcoming(30);
  const S = [];
  S.push(`<div class="kicker">${esc(D.settings.org)} all-hands, ${esc(A.fmtDate(t0))}</div><h2>Where our projects stand</h2>
   <div class="big3"><div class="h-green"><b class="num">${c.green || 0}</b>on track</div><div class="h-amber"><b class="num">${c.amber || 0}</b>at risk</div><div class="h-red"><b class="num">${c.red || 0}</b>off track</div><div><b class="num">${wins.length}</b>items delivered since ${esc(A.fmtDate(since))}</div></div>`);
  if (D.metrics.length) S.push(`<div class="kicker">Company metrics</div><h2>What the work is moving</h2>${metricCards(D.metrics)}`);
  if (D.metrics.length && D.active.some(p => p.metrics.length)) S.push(`<div class="kicker">Company metrics</div><h2>Which projects move which metric</h2>${A.metricMap(D)}`);
  S.push(`<div class="kicker">Portfolio</div><h2>Every active project</h2><div class="strip" style="height:56px">${ps.map(p => `<a class="h-${p.healthNow}" style="flex:1" title="${esc(p.name)}"></a>`).join('')}</div>
   <div class="cols" style="margin-top:3vh">${['red', 'amber', 'green', 'paused'].filter(h => c[h]).map(h => `<div>${A.pill(h)}<ul class="plain">${ps.filter(p => p.healthNow === h).map(p => `<li>${esc(p.name)} <span class="small mute">${esc(p.owner || 'No owner')}, ${Math.round(p.progress * 100)}%</span></li>`).join('')}</ul></div>`).join('')}</div>`);
  S.push(`<div class="kicker">Since ${esc(A.fmtDate(since))}</div><h2>Delivered</h2>${wins.length ? `<ul class="plain">${wins.slice(0, 12).map(e => `<li>${esc(e.label)} <span class="small mute">${esc(D.P.get(e.p)?.name || '')}</span></li>`).join('')}</ul>${wins.length > 12 ? `<p class="mute">and ${wins.length - 12} more</p>` : ''}` : '<p class="mute">Nothing marked done in this period.</p>'}
   ${moved.length || newP.length ? `<h3 class="sec">Status changes</h3><ul class="plain">${newP.map(e => `<li>New project: <b>${esc(e.label)}</b></li>`).join('')}${moved.map(e => `<li>${esc(e.label)}: ${esc(A.ST[e.from] || e.from || 'none')} → <b>${esc(A.ST[e.to] || e.to)}</b></li>`).join('')}</ul>` : ''}`);
  S.push(`<div class="kicker">Decisions and help needed</div><h2>Needs attention</h2>${attention.length ? `<ul class="plain">${attention.map(p => `<li>${A.pill(p.healthNow)} <b>${esc(p.name)}</b> <span class="mute">${esc(p.owner || 'No owner')}</span><div class="small">${esc(p.reasons.join('; ') || 'Marked at risk')}${p.risks.length ? '. Top risk: ' + esc(p.risks[0]) : ''}</div></li>`).join('')}</ul>` : '<p class="mute">Nothing is off track or at risk.</p>'}`);
  S.push(`<div class="kicker">Next 30 days</div><h2>Coming up</h2>${up.length ? `<ul class="plain">${up.slice(0, 12).map(x => `<li><span class="num">${esc(A.fmtDate(x.d))}</span>: ${x.k === 'Milestone' ? '<b>' + esc(x.x) + '</b>' : esc(x.x)} <span class="small mute">${esc(x.p.name)}${x.w ? ', ' + esc(x.w) : ''}</span></li>`).join('')}</ul>` : '<p class="mute">No dated milestones or tasks in the next 30 days.</p>'}`);
  ps.filter(p => p.healthNow !== 'paused').forEach(p => S.push(`<div class="kicker">${A.pill(p.healthNow)} ${esc(A.ST[p.status])}</div><h2>${esc(p.name)}</h2>
   <div class="cols"><div><p>${esc(p.description || '')}</p><dl class="kv"><dt>Owner</dt><dd>${A.who(p.owner)}</dd><dt>Team</dt><dd>${p.team.map(t => esc(t.name) + (t.role ? ` <span class="mute small">(${esc(t.role)})</span>` : '')).join(', ') || '<span class="mute">None recorded</span>'}</dd>
   <dt>Progress</dt><dd>${A.progress(p.progress, true)}</dd><dt>Next milestone</dt><dd>${p.nextMilestone ? esc(p.nextMilestone.title) + ', ' + esc(A.fmtDate(p.nextMilestone.date)) : '<span class="mute">None scheduled</span>'}</dd>
   ${p.metrics.length ? `<dt>Moves</dt><dd>${p.metrics.map(l => D.K.get(l.metric)?.name).filter(Boolean).map(esc).join(', ')}</dd>` : ''}</dl></div>
   <div>${p.reasons.length ? `<p class="late">${esc(p.reasons.join('; '))}</p>` : ''}<h3 class="sec">Up next</h3><ul class="plain">${[...p.open].sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5).map(t => `<li>${esc(t.text)} <span class="small mute">${esc(t.assignee || 'Unassigned')}${t.due ? ', ' + esc(A.fmtDate(t.due)) : ''}</span></li>`).join('') || '<li class="mute">No open tasks</li>'}</ul>
   ${p.risks.length ? `<h3 class="sec">Risks</h3><ul class="plain">${p.risks.slice(0, 3).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div></div>`));
  return S;
}
})();
