// ============================================================
// COLUMN CONFIGURATION
// ============================================================

import { escape } from './ui_utils.js';
import { loadApplicationStatus } from './storage.js';

/** Monogram tile for a company (deterministic tint from its name) */
export function companyAvatar(job) {
    const name = job.company || job.company_slug || 'Unknown';
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<span class="logo-tile" style="--h:${h}" aria-hidden="true">${escape(name.trim().charAt(0) || '?')}</span>`;
}

/** Build and return the column definitions for the job table */
export function createColumns() {
    return [
        {
            key: 'company',
            label: 'Company',
            sortable: false,
            render: job => `<span class="co-name">${escape(job.company || job.company_slug || 'Unknown')}</span>`
        },
        {
            key: 'title',
            label: 'Role',
            sortable: false,
            render: job => {
                const tier = (job.skill_level || '').toLowerCase();
                const tag = tier ? `<span class="tier">${escape(tier)}</span>` : '';
                return `<span class="role-title">${escape((job.title || 'Untitled').trim())}</span>${tag}`;
            }
        },
        {
            key: 'location',
            label: 'Location',
            sortable: false,
            render: job => {
                const loc = job.location && typeof job.location === 'object' ? job.location.name : job.location;
                return `<span class="loc"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg><span>${escape(loc || '—')}</span></span>`;
            }
        },
        {
            key: 'salary',
            label: 'Salary (est.)',
            sortable: true,
            render: job => {
                const s = job.salary;
                if (!s?.median) return '<span class="muted">—</span>';
                const fmt = n => '$' + (n / 1000).toFixed(0) + 'k';
                return `<span class="salary" title="p25: ${fmt(s.p25)} / p75: ${fmt(s.p75)} (n=${s.n})">${fmt(s.median)}</span>`;
            }
        },
        {
            key: 'ats',
            label: 'ATS',
            sortable: false,
            render: job => {
                const ats = job.ats || 'unknown';
                const classes = {
                    'greenhouse': 'ats-greenhouse',
                    'lever': 'ats-lever',
                    'workday': 'ats-workday',
                    'ashby': 'ats-ashby',
                    'icims': 'ats-icims',
                    'bamboohr': 'ats-bamboohr',
                    'workable': 'ats-workable',
                    'paylocity': 'ats-paylocity',
                };
                return `<span class="ats">${escape(ats)}</span>`;
            }
        },
        {
            key: 'url',
            label: 'Apply',
            sortable: false,
            render: job => {
                const url = job.absolute_url || job.url;
                return url
                    ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" class="apply-btn">Apply<svg class="ic" aria-hidden="true"><use href="#i-arrow-ur"/></svg></a>`
                    : 'N/A';
            }
        },
        {
            key: 'posted',
            label: 'Posted',
            sortable: true,
            render: job => {
                const raw = job.updated_at || job.first_seen;
                if (!raw) return '<span class="muted">—</span>';
                const d = new Date(raw);
                if (isNaN(d.getTime())) return '<span class="muted">—</span>';
                const days = Math.floor((Date.now() - d) / 86400000);
                let txt;
                if (days <= 0) txt = 'Today';
                else if (days === 1) txt = 'Yesterday';
                else if (days < 30) txt = `${days}d ago`;
                else txt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `<span class="posted">${txt}</span>`;
            }
        },
        {
            key: 'actions',
            label: 'Save',
            sortable: false,
            render: job => {
                const url = job.absolute_url || job.url;
                return `
                    <div class="track-group" role="group">
                        <input type="checkbox" class="btn-check save-checkbox"
                               id="save-${escape(url)}"
                               data-job-url="${escape(url)}">
                        <label for="save-${escape(url)}" title="Save for later" aria-label="Save for later"><svg class="ic" aria-hidden="true"><use href="#i-bookmark"/></svg></label>

                        <input type="checkbox" class="btn-check apply-checkbox"
                               id="apply-${escape(url)}"
                               data-job-url="${escape(url)}">
                        <label for="apply-${escape(url)}" title="Mark as applied" aria-label="Mark as applied"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></label>

                        <input type="checkbox" class="btn-check ignored-checkbox"
                               id="ignore-${escape(url)}"
                               data-job-url="${escape(url)}">
                        <label for="ignore-${escape(url)}" title="Not interested" aria-label="Not interested"><svg class="ic" aria-hidden="true"><use href="#i-ban"/></svg></label>
                    </div>`;
            }
        }
    ];
}