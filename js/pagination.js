// ============================================================
// PAGINATION
// ============================================================

/**
 * Update the result count, "showing" text and numbered pager.
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {number} totalJobs - Total filtered job count
 * @param {number} perPage
 */
export function updatePagination(currentPage, totalPages, totalJobs, perPage = 50) {
    const count = document.getElementById('result-count');
    if (count) count.textContent = totalJobs.toLocaleString();

    const apply = document.getElementById('apply-filters');
    if (apply) apply.textContent = `Show ${totalJobs.toLocaleString()} result${totalJobs === 1 ? '' : 's'}`;

    const from = totalJobs === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const to = Math.min(currentPage * perPage, totalJobs);
    const info = document.getElementById('page-info-bottom');
    if (info) {
        info.innerHTML = `Showing <b>${from.toLocaleString()}</b> to <b>${to.toLocaleString()}</b> of <b>${totalJobs.toLocaleString()}</b> results`;
    }

    const prev = document.getElementById('prev-page-bottom');
    const next = document.getElementById('next-page-bottom');
    if (prev) prev.disabled = currentPage === 1;
    if (next) next.disabled = currentPage === totalPages;

    // numbered pages: 1 … n-1 [n] n+1 … last
    const wrap = document.getElementById('pager-pages');
    if (!wrap) return;
    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    let html = '';
    let last = 0;
    for (const p of sorted) {
        if (p - last > 1) html += '<span class="pg-gap">…</span>';
        html += `<button type="button" class="pg${p === currentPage ? ' active' : ''}" data-page="${p}"${p === currentPage ? ' aria-current="page"' : ''}>${p.toLocaleString()}</button>`;
        last = p;
    }
    wrap.innerHTML = html;
}
