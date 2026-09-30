// ============================================================
// RENDERER
// ============================================================

import { updatePagination } from './pagination.js';
import { loadApplicationStatus } from './storage.js';
import { escape } from './ui_utils.js';
import { updateTabCounts } from './ui.js';

/**
 * Render the job rows for the current page.
 * @param {object} app - The JobBoardApp instance (state holder)
 */
export function render(app) {
    const body = document.getElementById('jobs-body');
    if (!body) return;

    const totalJobsCount = app.getTotalJobsCount();
    const totalPages = Math.max(1, Math.ceil(totalJobsCount / app.perPage));

    if (app.currentPage > totalPages) app.currentPage = totalPages;
    if (app.currentPage < 1) app.currentPage = 1;

    const sourceJobs = (app.sortState && app.sortState.key && app.sortedJobs)
        ? app.sortedJobs
        : app.filteredJobs;

    const start = (app.currentPage - 1) * app.perPage;
    const pageJobs = sourceJobs.slice(start, start + app.perPage);

    updateTabCounts(app);

    if (pageJobs.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="7">No roles match these filters — try removing one.</td></tr>';
        updatePagination(app.currentPage, totalPages, totalJobsCount, app.perPage);
        return;
    }

    const col = Object.fromEntries(app.columns.map(c => [c.key, c]));
    body.innerHTML = pageJobs.map(job => {
        const company = job.company || job.company_slug || 'Unknown';
        const loc = job.location && typeof job.location === 'object' ? job.location.name : job.location;
        const tier = (job.skill_level || '').toLowerCase();
        const tag = tier ? `<span class="tag">${escape(tier.charAt(0).toUpperCase() + tier.slice(1))}</span>` : '';
        return `
        <tr>
            <td data-label="Role">
                <div class="role-cell">
                    <span class="role-title">${escape((job.title || 'Untitled').trim())}</span>${tag}
                </div>
            </td>
            <td data-label="Company">
                <span class="co-name">${escape(company)}</span>
            </td>
            <td data-label="Location"><span class="loc">${escape(loc || '—')}</span></td>
            <td data-label="Platform"><span class="plat">${escape(job.ats || '—')}</span></td>
            <td data-label="Est. salary">${col.salary.render(job)}</td>
            <td data-label="Posted">${col.posted.render(job)}</td>
            <td class="td-actions">${col.actions.render(job)}${col.url.render(job)}</td>
        </tr>`;
    }).join('');

    // Reflect saved / applied / skipped state from localStorage
    const apps = loadApplicationStatus();
    const byStatus = { saved: '.save-checkbox', applied: '.apply-checkbox', ignored: '.ignored-checkbox' };
    body.querySelectorAll('.track-group').forEach(group => {
        const first = group.querySelector('[data-job-url]');
        const status = first && apps[first.dataset.jobUrl]?.status;
        if (status && byStatus[status]) {
            const box = group.querySelector(byStatus[status]);
            if (box) box.checked = true;
        }
    });

    updatePagination(app.currentPage, totalPages, totalJobsCount, app.perPage);
}
