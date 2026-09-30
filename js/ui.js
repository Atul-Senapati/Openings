// ============================================================
// UI CHROME: nav, tabs, dropdown buttons, active-filter chips,
// header graphics, pager, sorting, instant save
// ============================================================

import { showToast } from './ui_utils.js';
import { updateURL } from './url_state.js';
import { loadApplicationStatus, saveApplicationStatus, deleteApplicationStatus } from './storage.js';

const $ = id => document.getElementById(id);
const CHEV = '<svg class="ic" aria-hidden="true"><use href="#i-down"/></svg>';

// ── Setup ───────────────────────────────────────────────────
export function setupQuickFilters(app) {
    // Quick-pick options (chips / rows) set the real form control
    document.querySelectorAll('[data-set]').forEach(btn => {
        btn.addEventListener('click', () => {
            const el = $(btn.dataset.set);
            if (!el) return;
            el.value = btn.dataset.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    // Text / number fields apply when committed (blur or Enter)
    ['filter-company', 'filter-salary-min', 'filter-include', 'filter-exclude'].forEach(id => {
        $(id).addEventListener('change', () => app.applyFilters());
    });

    $('search-btn')?.addEventListener('click', () => app.applyFilters());

    // Title / location filter as you type (after a short pause)
    let typeTimer;
    ['filter-title', 'filter-location'].forEach(id => {
        $(id).addEventListener('input', () => {
            clearTimeout(typeTimer);
            typeTimer = setTimeout(() => app.applyFilters(), 450);
        });
    });

    // Collapse state is remembered per section
    document.querySelectorAll('.fsec').forEach(d => {
        const key = 'fsec:' + d.querySelector('.fsec-title').textContent;
        try { const v = localStorage.getItem(key); if (v !== null) d.open = v === '1'; } catch { }
        d.addEventListener('toggle', () => { try { localStorage.setItem(key, d.open ? '1' : '0'); } catch { } });
    });

    // Dropdown buttons (proxy the real <select>s)
    document.querySelectorAll('.dd').forEach(buildDropdown);
    document.addEventListener('click', e => { if (!e.target.closest('.dd')) closeDropdowns(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdowns(); });

    // Drawer controls that don't already apply instantly
    ['filter-posted', 'filter-remote-only', 'filter-hide-recruiters'].forEach(id => {
        $(id).addEventListener('change', () => app.applyFilters());
    });
    $('clear-filters-2')?.addEventListener('click', () => app.clearFilters());

    // Numbered pager
    $('pager-pages').addEventListener('click', e => {
        const btn = e.target.closest('[data-page]');
        if (!btn) return;
        app.currentPage = parseInt(btn.dataset.page, 10);
        app.triggerPageUpdate();
    });

    // Sortable column headers
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            const cur = app.sortState?.key === key ? app.sortState.direction : null;
            setSort(app, `${key}:${cur === 'desc' ? 'asc' : 'desc'}`);
        });
    });

    // Sort (hidden select is the source of truth)
    $('sort-select').addEventListener('change', e => setSort(app, e.target.value));

    // "/" or Cmd/Ctrl+K focuses search
    document.addEventListener('keydown', e => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
        if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            $('filter-title').focus();
        }
    });

    // Track buttons save instantly
    document.addEventListener('change', e => {
        const t = e.target;
        if (!t.matches?.('.save-checkbox, .apply-checkbox, .ignored-checkbox')) return;
        const url = t.dataset.jobUrl;
        if (!url) return;
        if (!t.checked) { deleteApplicationStatus(url); }
        else {
            const status = t.classList.contains('save-checkbox') ? 'saved'
                : t.classList.contains('apply-checkbox') ? 'applied' : 'ignored';
            saveApplicationStatus(url, status);
        }
        updateTabCounts(app);
    });
}

function closeNavDrawer() {
    const el = $('nav-drawer');
    if (el && window.bootstrap && el.classList.contains('show')) bootstrap.Offcanvas.getInstance(el)?.hide();
}

// ── Sorting ─────────────────────────────────────────────────
function setSort(app, value) {
    if (!app.isFullyLoaded) {
        showToast('Please wait until all listings finish loading…', 'warning');
        syncSortSelect(app);
        return;
    }
    const [key, direction] = value ? value.split(':') : [null, 'asc'];
    app.sortState = { key, direction };
    app.currentPage = 1;
    updateURL(app.filterState, app.currentPage, app.sortState);
    syncSortSelect(app);
    syncDropdowns();
    syncSortHeaders(app);
    if (key) app.sortAndRender();
    else { app.sortedJobs = null; app.render(); }
}

function syncSortSelect(app) {
    const sel = $('sort-select');
    if (!sel) return;
    const want = app.sortState?.key ? `${app.sortState.key}:${app.sortState.direction}` : '';
    sel.value = [...sel.options].some(o => o.value === want) ? want : '';
}

function syncSortHeaders(app) {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const on = app.sortState?.key === th.dataset.sort;
        th.classList.toggle('sorted', on);
        th.dataset.dir = on ? app.sortState.direction : '';
    });
}

// ── Dropdown buttons ────────────────────────────────────────
function buildDropdown(dd) {
    const select = $(dd.dataset.select);
    if (!select) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gbtn dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('ul');
    menu.className = 'dd-menu';
    menu.setAttribute('role', 'listbox');
    [...select.options].forEach(opt => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.dataset.value = opt.value;
        li.textContent = opt.textContent;
        li.addEventListener('click', () => {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            closeDropdowns();
        });
        menu.append(li);
    });

    btn.addEventListener('click', () => {
        const open = !dd.classList.contains('open');
        closeDropdowns();
        dd.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
    });

    dd.append(btn, menu);
    dd._refresh = () => {
        const cur = select.selectedOptions[0];
        const active = select.value !== '';
        btn.innerHTML = `<span>${dd.dataset.label}</span>${active ? `<span class="gval">${cur.textContent}</span>` : ''}${CHEV}`;
        btn.classList.toggle('has-value', active);
        menu.querySelectorAll('li').forEach(li => li.classList.toggle('sel', li.dataset.value === select.value));
    };
    dd._refresh();
}

function closeDropdowns() {
    document.querySelectorAll('.dd.open').forEach(d => {
        d.classList.remove('open');
        d.querySelector('.dd-btn')?.setAttribute('aria-expanded', 'false');
    });
}

function syncDropdowns() {
    document.querySelectorAll('.dd').forEach(d => d._refresh?.());
}

// ── Tab counts ──────────────────────────────────────────────
export function updateTabCounts(app) {
    const counts = { saved: 0, applied: 0, ignored: 0 };
    for (const v of Object.values(loadApplicationStatus())) if (v.status in counts) counts[v.status]++;
    const set = (k, n) => { const el = document.querySelector(`[data-count="${k}"]`); if (el) el.textContent = n.toLocaleString(); };
    set('all', app?.allJobs?.length || 0);
    set('saved', counts.saved);
    set('applied', counts.applied);
    set('ignored', counts.ignored);
}

// ── Active filter chips ────────────────────────────────────
const CHIP_DEFS = [
    { id: 'filter-title', label: v => `Title: ${v}`, reset: el => el.value = '' },
    { id: 'filter-location', label: v => `Location: ${v}`, reset: el => el.value = '' },
    { id: 'filter-company', label: v => `Company: ${v}`, reset: el => el.value = '' },
    { id: 'filter-salary-min', label: v => `Salary ≥ $${Number(v).toLocaleString()}`, reset: el => el.value = '' },
    { id: 'filter-skill-level', label: (v, el) => `Level: ${el.selectedOptions[0].text}`, reset: el => el.value = '' },
    { id: 'filter-posted', label: (v, el) => el.selectedOptions[0].text, reset: el => el.value = '' },
    { id: 'filter-ats', label: (v, el) => `Platform: ${el.selectedOptions[0].text}`, reset: el => el.value = '' },
    { id: 'filter-status', label: (v, el) => `List: ${el.selectedOptions[0].text}`, reset: el => el.value = '' },
    { id: 'filter-include', label: v => `Includes: ${v}`, reset: el => el.value = '' },
    { id: 'filter-exclude', label: v => `Excludes: ${v}`, reset: el => el.value = '' },
    { id: 'filter-remote-only', check: true, on: true, label: () => 'Remote only', reset: el => el.checked = false },
    { id: 'filter-hide-applied', check: true, on: true, label: () => 'Hiding applied', reset: el => el.checked = false },
    { id: 'filter-hide-recruiters', check: true, on: false, label: () => 'Recruiters shown', reset: el => el.checked = true },
];

function summaryText(def, el) {
    if (def.check) return def.label();
    if (el.tagName === 'SELECT') return el.selectedOptions[0].text;
    if (el.type === 'number') return `$${Number(el.value).toLocaleString()}+`;
    const v = el.value.trim();
    return v.length > 18 ? v.slice(0, 17) + '…' : v;
}

export function syncFilterUI(app) {
    // quick-pick options reflect the real control
    document.querySelectorAll('[data-set]').forEach(btn => {
        const el = $(btn.dataset.set);
        btn.classList.toggle('active', !!el && el.value === btn.dataset.value);
    });

    // section summaries (visible even when collapsed)
    document.querySelectorAll('.fsec').forEach(sec => {
        const parts = [];
        sec.dataset.fields.split(',').forEach(id => {
            const def = CHIP_DEFS.find(d => d.id === id);
            const el = $(id);
            if (!def || !el) return;
            const on = def.check ? el.checked === def.on : !!el.value.trim();
            if (on) parts.push(summaryText(def, el));
        });
        sec.querySelector('.sum').textContent = parts.join(', ');
        sec.classList.toggle('has-value', parts.length > 0);
    });

    // dropdowns + sort UI
    syncSortSelect(app);
    syncDropdowns();
    syncSortHeaders(app);

    // active chips
    const wrap = $('active-filters');
    wrap.textContent = '';
    let count = 0;
    CHIP_DEFS.forEach(def => {
        const el = $(def.id);
        const active = def.check ? el.checked === def.on : !!el.value.trim();
        if (!active) return;
        count++;

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'fchip';
        chip.setAttribute('aria-label', `Remove filter: ${def.label(el.value, el)}`);
        chip.append(def.label(el.value.trim?.() ?? el.value, el));
        const x = document.createElement('b');
        x.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>';
        chip.append(x);
        chip.addEventListener('click', () => { def.reset(el); app.applyFilters(); });
        wrap.append(chip);
    });
    $('chips-row').hidden = count === 0;

    document.querySelectorAll('.count-badge').forEach(b => { b.textContent = count; b.hidden = count === 0; });
}

// ── Header graphics (computed from the loaded data) ─────────
const MIX_SHADES = ['#ff5a1f', '#ff7a45', '#ff9a6e', '#ffb695', '#ffcfb9', '#ffe1d3', '#fff0e8'];
const ATS_NAMES = { bamboohr: 'BambooHR', icims: 'iCIMS' };
const compact = n => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

export function updateInsights(jobs) {
    const DAYS = 14;
    const keys = [];
    for (let i = DAYS - 1; i >= 0; i--) keys.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    const perDay = new Map(keys.map(k => [k, 0]));
    const ats = new Map();

    for (const j of jobs) {
        const d = (j.first_seen || '').slice(0, 10);
        if (perDay.has(d)) perDay.set(d, perDay.get(d) + 1);
        const a = (j.ats || 'other').toLowerCase();
        ats.set(a, (ats.get(a) || 0) + 1);
    }

    const vals = keys.map(k => perDay.get(k));
    const max = Math.max(...vals, 1);
    const spark = $('spark');
    if (spark) {
        spark.innerHTML = vals.map((v, i) => {
            const h = Math.max(1.5, (v / max) * 20);
            return `<rect class="${i === vals.length - 1 ? 'spark-now' : ''}" x="${i * 5}" y="${22 - h}" width="3.6" height="${h}" rx="1"><title>${keys[i]}: ${v.toLocaleString()} new</title></rect>`;
        }).join('');
    }

    const total = jobs.length || 1;
    const rows = [...ats.entries()].sort((a, b) => b[1] - a[1]);
    const name = n => ATS_NAMES[n] || n.charAt(0).toUpperCase() + n.slice(1);

    const mix = $('mix');
    if (mix) {
        mix.textContent = '';
        rows.forEach(([n, count], i) => {
            const seg = document.createElement('i');
            seg.style.flexGrow = count;
            seg.style.background = MIX_SHADES[Math.min(i, MIX_SHADES.length - 1)];
            seg.title = `${name(n)}: ${count.toLocaleString()} (${Math.round(count / total * 100)}%)`;
            mix.append(seg);
        });
    }
    const legend = $('mix-legend');
    if (legend) legend.textContent = rows.slice(0, 3).map(([n, c]) => `${name(n)} ${Math.round(c / total * 100)}%`).join(' · ');

    document.querySelectorAll('[data-ats]').forEach(el => {
        const c = ats.get(el.dataset.ats);
        el.textContent = c ? compact(c) : '';
    });
}


// ── Loading progress (chunks fetched / total) ──────────────
export function setLoadProgress(done, total, failed = 0) {
    const el = $('load-progress');
    if (!el) return;
    const pct = total ? Math.round(done / total * 100) : 0;
    const finished = done >= total;
    el.hidden = false;
    el.classList.toggle('done', finished);
    el.querySelector('.ring-fg').style.strokeDasharray = `${pct} 100`;
    el.querySelector('.lp-text').textContent = finished
        ? (failed ? `Loaded · ${failed} part${failed > 1 ? 's' : ''} unavailable` : 'Up to date')
        : `Loading listings · ${pct}%`;
    if (finished) setTimeout(() => el.classList.add('fade'), failed ? 5000 : 1600);
    if (finished) setTimeout(() => { el.hidden = true; el.classList.remove('fade'); }, failed ? 5600 : 2200);
}
