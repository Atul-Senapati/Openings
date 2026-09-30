// ============================================================
// EVENT LISTENERS
// ============================================================

import { escape, showToast, updateFABVisibility } from './ui_utils.js';
import { saveApplicationStatus, deleteApplicationStatus } from './storage.js';

const ACTION_CHECKBOXES = ['.save-checkbox', '.apply-checkbox', '.ignored-checkbox'];

/**
 * Wire up all DOM event listeners.
 * @param {object} app - The JobBoardApp instance
 */
export function setupEventListeners(app) {

    // ── Pagination (top + bottom) ────────────────────────────
    document.getElementById('prev-page')?.addEventListener('click', () => app.previousPage());
    document.getElementById('next-page')?.addEventListener('click', () => app.nextPage());
    document.getElementById('prev-page-bottom').addEventListener('click', () => app.previousPage());
    document.getElementById('next-page-bottom').addEventListener('click', () => app.nextPage());

    // ── Per-page selector ────────────────────────────────────
    document.getElementById('per-page').addEventListener('change', (e) => {
        app.perPage = parseInt(e.target.value);
        app.currentPage = 1;
        app.render();
    });

    // ── Filter buttons ───────────────────────────────────────
    document.getElementById('apply-filters').addEventListener('click', () => app.applyFilters());
    document.getElementById('clear-filters').addEventListener('click', () => app.clearFilters());

    // Enter key on text filter inputs
    ['filter-title', 'filter-company', 'filter-location', 'filter-salary-min',
        'filter-exclude', 'filter-include'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') app.applyFilters();
            });
        });

    // ── Dropdown filters (instant apply) ─────────────────────
    document.getElementById('filter-status').addEventListener('change', () => app.applyFilters());
    document.getElementById('filter-ats').addEventListener('change', () => app.applyFilters());
    document.getElementById('filter-skill-level').addEventListener('change', () => app.applyFilters());
    document.getElementById('filter-hide-applied').addEventListener('change', () => app.applyFilters());

    // ── Batch processing ─────────────────────────────────────
    document.getElementById('process-batch')?.addEventListener('click', () => app.handleBatch());
    document.getElementById('process-fab')?.addEventListener('click', () => app.handleBatch());

    // ── Delegated: FAB visibility on checkbox toggle ─────────
    document.addEventListener('change', (e) => {
        if (e.target.matches(ACTION_CHECKBOXES.join(', '))) {
            updateFABVisibility();
        }
    });

    // ── Delegated: mutual exclusion (only one state at a time) ──
    document.addEventListener('change', (e) => {
        if (!e.target.matches(ACTION_CHECKBOXES.join(', ')) || !e.target.checked) return;

        const jobUrl = e.target.dataset.jobUrl;
        const allClasses = ['save-checkbox', 'apply-checkbox', 'ignored-checkbox'];
        const clickedClass = allClasses.find(cls => e.target.classList.contains(cls));

        // Uncheck the other two
        allClasses.forEach(cls => {
            if (cls !== clickedClass) {
                const other = document.querySelector(`.${cls}[data-job-url="${CSS.escape(jobUrl)}"]`);
                if (other) other.checked = false;
            }
        });
    });
}