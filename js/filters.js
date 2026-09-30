// ============================================================
// FILTERING
// ============================================================

import { escapeRegex } from './ui_utils.js';
import { loadApplicationStatus } from './storage.js';

/**
 * Read current filter values from the DOM.
 * @returns {object} Filter state object
 */
export function readFilterInputs() {
    return {
        hideRecruiters: document.getElementById('filter-hide-recruiters').checked,
        remoteOnly: document.getElementById('filter-remote-only').checked,
        hideApplied: document.getElementById('filter-hide-applied').checked,
        title: document.getElementById('filter-title').value.toLowerCase().trim(),
        company: document.getElementById('filter-company').value.toLowerCase().trim(),
        location: document.getElementById('filter-location').value.toLowerCase().trim(),
        salary: document.getElementById('filter-salary-min').value,
        status: document.getElementById('filter-status').value,
        ats: document.getElementById('filter-ats').value,
        skill_level: document.getElementById('filter-skill-level').value,
        posted: document.getElementById('filter-posted').value,
        exclude: document.getElementById('filter-exclude').value.toLowerCase().trim(),
        include: document.getElementById('filter-include').value.toLowerCase().trim(),
    };
}

function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

function fuzzyMatch(search, text, threshold = 0.75) {
    if (!search) return true;
    search = search.toLowerCase();
    text = text.toLowerCase();

    if (text.includes(search)) return true;

    const words = text.split(/\W+/).filter(Boolean);
    return words.some(word => {
        const maxLen = Math.max(word.length, search.length);
        if (maxLen === 0) return false;
        const similarity = 1 - levenshtein(search, word) / maxLen;
        return similarity >= threshold;
    });
}


// ── Location matching ──────────────────────────────────────
const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const LOCATION_ALIASES = {
    'usa': 'united states', 'us': 'united states', 'u.s.': 'united states', 'u.s.a.': 'united states', 'america': 'united states',
    'uk': 'united kingdom', 'u.k.': 'united kingdom', 'britain': 'united kingdom', 'england': 'united kingdom',
    'uae': 'united arab emirates', 'bangalore': 'bengaluru', 'bombay': 'mumbai',
};

/**
 * Build a whole-word, case-insensitive location matcher with country aliases.
 * Built once per filter run so it's cheap across 1M+ jobs.
 */
export function makeLocationMatcher(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return () => true;
    const target = LOCATION_ALIASES[q] || q;
    const word = s => new RegExp(`(^|[^a-z])${escapeRegex(s)}($|[^a-z])`, 'i');
    const res = [word(target)];
    if (target !== q) res.push(word(q));
    const isUS = target === 'united states';
    const stateRe = /,\s*([A-Z]{2})\b/;

    return raw => {
        if (!raw) return false;
        for (const re of res) if (re.test(raw)) return true;
        if (isUS) { const m = raw.match(stateRe); if (m && US_STATES.has(m[1])) return true; }
        return false;
    };
}

/**
 * Filter the full jobs array based on the current filter inputs.
 * @param {Array} allJobs - The complete jobs array
 * @returns {{ filteredJobs: Array, filterState: object }}
 */
export function filterJobs(allJobs) {
    const f = readFilterInputs();
    const apps = loadApplicationStatus();

    const titleRegex = f.title ? new RegExp(`\\b${escapeRegex(f.title)}\\b`, 'i') : null;
    const companyRegex = f.company ? new RegExp(`\\b${escapeRegex(f.company)}\\b`, 'i') : null;
    const locationRegex = f.location ? new RegExp(`\\b${escapeRegex(f.location)}\\b`, 'i') : null;

    const filterState = {
        title: f.title,
        company: f.company,
        location: f.location,
        salary: f.salary,
        remoteOnly: f.remoteOnly,
        status: f.status,
        ats: f.ats,
        skill_level: f.skill_level,
        posted: f.posted,
        exclude: f.exclude,
        include: f.include
    };

    const matchLoc = makeLocationMatcher(f.location);

    const filteredJobs = allJobs.filter(job => {
        // Recruiter filter
        if (f.hideRecruiters && job.is_recruiter === true) return false;

        // Application status
        const url = job.url;
        const jobStatus = apps[url]?.status || '';

        if (f.hideApplied && (jobStatus === 'applied' || jobStatus === 'ignored')) return false;
        if (f.status && jobStatus !== f.status) return false;

        // Text fields
        const title = (job.title || '').toLowerCase();
        const company = ((job.company || job.company_slug) || '').toLowerCase();
        let location = '';
        if (job.location) {
            location = typeof job.location === 'object'
                ? (job.location.name || '').toLowerCase()
                : (job.location || '').toLowerCase();
        }

        // in your filter state collection
        const minSalary = parseInt(document.getElementById('filter-salary-min').value) || 0;

        // in filteredJobs
        if (minSalary > 0) {
            const median = job.salary?.median;
            if (!median || median < minSalary) return false;
        }

        // Remote only
        if (f.remoteOnly) {
            const isRemote = location.includes('remote')
                || (job.workplaceType && job.workplaceType.toLowerCase() === 'remote');
            if (!isRemote) return false;
        }

        // ATS
        if (f.ats) {
            const jobAts = (job.ats || '').toLowerCase();
            if (jobAts !== f.ats.toLowerCase()) return false;
        }

        // Skill level
        if (f.skill_level) {
            const jobSkillLevel = (job.skill_level || '').toLowerCase();
            if (jobSkillLevel !== f.skill_level.toLowerCase()) return false;
        }

        // Date posted (within N days)
        if (f.posted) {
            const days = parseInt(f.posted, 10);
            const raw = job.updated_at || job.first_seen;
            const t = raw ? Date.parse(raw) : NaN;
            if (isNaN(t)) return false;   // no date = excluded when a date filter is active
            const ageDays = (Date.now() - t) / 86400000;
            if (ageDays > days) return false;
        }

        // Exclude title keywords
        if (f.exclude) {
            const excludeTerms = f.exclude.split(',').map(t => t.trim()).filter(Boolean);
            if (excludeTerms.some(term => title.includes(term))) return false;
        }

        // Include Title keywords
        if (f.include) {
            const includeTerms = f.include.split(',').map(t => t.trim()).filter(Boolean);
            if (!includeTerms.some(term => title.includes(term))) return false;
        }

        return (
            (!titleRegex || titleRegex.test(title)) &&
            (!companyRegex || companyRegex.test(company)) &&
            matchLoc(typeof job.location === 'object' ? job.location?.name : job.location)
        );
    });

    return { filteredJobs, filterState };
}

/** Reset all filter DOM inputs to defaults */
export function clearFilterInputs() {
    document.getElementById('filter-title').value = '';
    document.getElementById('filter-company').value = '';
    document.getElementById('filter-location').value = '';
    document.getElementById('filter-salary-min').value = '';
    document.getElementById('filter-exclude').value = '';
    document.getElementById('filter-include').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-ats').value = '';
    document.getElementById('filter-skill-level').value = '';
    document.getElementById('filter-posted').value = '';
    document.getElementById('filter-hide-recruiters').checked = true;
    document.getElementById('filter-remote-only').checked = false;
    document.getElementById('filter-hide-applied').checked = false;
}