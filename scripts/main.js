const StatusEnum = Object.freeze({
    Unknown: 'Unknown',
    Online: 'Online',
    XL: 'Blocking',
    L: 'HighPriority',
    M: 'RegularPriority',
    S: 'MinorIssue',
    UnderInvestigation: 'UnderInvestigation',
    Maintenance: 'Maintenance',
    Announcement: 'Announcement'
});

// Highest priority first: the overall status is the first one present among the current issues.
const STATUS_PRIORITY = [
    StatusEnum.Maintenance,
    StatusEnum.XL,
    StatusEnum.L,
    StatusEnum.M,
    StatusEnum.S,
    StatusEnum.UnderInvestigation
];

const STATUS_URL = 'status.json';
const REFRESH_INTERVAL_MS = 60 * 1000;
const HISTORY_BATCH_SIZE = 10;
const COLLAPSED_BODY_HEIGHT = 240;
const FILTER_HASH_PREFIX = '#onderdeel=';

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

const state = {
    status: null,
    filter: null,
    lastLoaded: 0,
    renderedSections: {},
    historyIssues: [],
    historyRendered: 0,
    historyLastMonth: null
};

// ---------- Formatting ----------

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDateTime(isoDate) {
    const date = new Date(isoDate);
    return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}

function formatMonth(isoDate) {
    const month = monthFormat.format(new Date(isoDate));
    return month.charAt(0).toUpperCase() + month.slice(1);
}

function formatDuration(fromIso, toIso) {
    const totalMinutes = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days} ${days === 1 ? 'dag' : 'dagen'}${hours > 0 ? ` ${hours} uur` : ''}`;
    }
    if (hours > 0) {
        return `${hours} uur${minutes > 0 ? ` ${minutes} min` : ''}`;
    }
    return `${minutes} min`;
}

// ---------- Status ----------

function getStatusOfMilestone(milestone) {
    switch ((milestone ?? '').toLowerCase()) {
        case 'xl':
            return StatusEnum.XL;
        case 'l':
            return StatusEnum.L;
        case 'm':
            return StatusEnum.M;
        case 's':
            return StatusEnum.S;
        case 'maintenance':
            return StatusEnum.Maintenance;
        case 'under investigation':
            return StatusEnum.UnderInvestigation;
        case 'announcement':
            return StatusEnum.Announcement;
        default:
            return StatusEnum.Unknown;
    }
}

function getStatusOfMilestones(milestones) {
    if (milestones.length === 0) {
        return StatusEnum.Online;
    }

    const statuses = milestones.map(getStatusOfMilestone);
    return STATUS_PRIORITY.find(status => statuses.includes(status)) ?? StatusEnum.Unknown;
}

function getStatusKey(status) {
    switch (status) {
        case StatusEnum.Online:
            return 'online';
        case StatusEnum.XL:
            return 'xl';
        case StatusEnum.L:
            return 'l';
        case StatusEnum.M:
            return 'm';
        case StatusEnum.S:
            return 's';
        case StatusEnum.UnderInvestigation:
            return 'investigation';
        case StatusEnum.Maintenance:
            return 'maintenance';
        case StatusEnum.Announcement:
            return 'announcement';
        default:
            return 'unknown';
    }
}

function getStatusIcon(status) {
    switch (status) {
        case StatusEnum.Online:
            return 'fa-check';
        case StatusEnum.XL:
        case StatusEnum.L:
        case StatusEnum.M:
        case StatusEnum.S:
            return 'fa-exclamation-triangle';
        case StatusEnum.UnderInvestigation:
            return 'fa-search';
        case StatusEnum.Maintenance:
            return 'fa-tools';
        case StatusEnum.Announcement:
            return 'fa-envelope-open-text';
        default:
            return 'fa-question';
    }
}

function getStatusDescription(status) {
    switch (status) {
        case StatusEnum.Online:
            return 'Online';
        case StatusEnum.XL:
            return 'XL';
        case StatusEnum.L:
            return 'L';
        case StatusEnum.M:
            return 'M';
        case StatusEnum.S:
            return 'S';
        case StatusEnum.UnderInvestigation:
            return 'Wordt onderzocht';
        case StatusEnum.Maintenance:
            return 'Onderhoud';
        case StatusEnum.Announcement:
            return 'Aankondiging';
        default:
            return 'Onbekend';
    }
}

function getSystemStatusText(status) {
    switch (status) {
        case StatusEnum.Maintenance:
            return 'Systeem is in onderhoud';
        case StatusEnum.XL:
            return 'Ernstige verstoring geconstateerd';
        case StatusEnum.L:
        case StatusEnum.M:
        case StatusEnum.S:
            return 'Storing geconstateerd';
        case StatusEnum.UnderInvestigation:
            return 'Er zijn meldingen geweest over verstoringen, deze worden momenteel onderzocht.';
        default:
            return 'Momenteel zijn er geen actuele verstoringen bekend.';
    }
}

// Maintenance and announcements are typically opened in advance, so their open time is no outage duration.
function isIncident(status) {
    return [StatusEnum.XL, StatusEnum.L, StatusEnum.M, StatusEnum.S, StatusEnum.UnderInvestigation].includes(status);
}

function isAnnouncement(issue) {
    return getStatusOfMilestone(issue.milestone) === StatusEnum.Announcement;
}

function matchesFilter(issue) {
    return !state.filter || issue.labels.includes(state.filter);
}

function getCurrentIssues() {
    return state.status.openIssues.filter(issue => !isAnnouncement(issue));
}

function buildComponents() {
    const currentIssues = getCurrentIssues();
    return state.status.labels.map(name => {
        const milestones = [...new Set(currentIssues
            .filter(issue => issue.labels.includes(name))
            .map(issue => issue.milestone))];
        return { name, status: getStatusOfMilestones(milestones) };
    });
}

// ---------- Rendering ----------

function renderSystemStatusCard(statusKey, iconClass, text) {
    const card = document.getElementById('system-status');
    card.className = `card status-card mb-2 status-${statusKey}`;
    card.innerHTML = `
        <div class="status-card-icon"><i class="fas ${iconClass} fa-lg" aria-hidden="true"></i></div>
        <h5 class="card-title mb-0">${escapeHtml(text)}</h5>`;
}

function renderFavicon(status) {
    const colors = { online: '#1a7f32', xl: '#d51c00', l: '#fe9c39', m: '#fe9c39', s: '#1b7d80' };
    const color = colors[getStatusKey(status)] ?? '#495057';
    const mark = status === StatusEnum.Online
        ? '<path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<text x="16" y="23" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">!</text>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="${color}"/>${mark}</svg>`;
    document.getElementById('favicon').href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderSystemStatus() {
    const status = getStatusOfMilestones(getCurrentIssues().map(issue => issue.milestone));
    renderSystemStatusCard(getStatusKey(status), getStatusIcon(status), getSystemStatusText(status));
    renderFavicon(status);
}

function renderLastUpdated() {
    document.getElementById('last-updated').textContent = formatDateTime(state.status.generatedAt);
}

function renderComponents() {
    document.getElementById('status-items').innerHTML = buildComponents().map(component => {
        const key = getStatusKey(component.status);
        const selected = state.filter === component.name;

        return `
            <button type="button" class="list-group-item list-group-item-action component status-${key}${selected ? ' is-selected' : ''}"
                data-component="${escapeHtml(component.name)}" aria-pressed="${selected}"
                title="${selected ? 'Filter wissen' : 'Alleen meldingen voor dit onderdeel tonen'}">
                <span>
                    <i class="fas ${getStatusIcon(component.status)} status-icon me-2" aria-hidden="true"></i>
                    ${escapeHtml(component.name)}
                </span>
                <span class="status-text">${escapeHtml(getStatusDescription(component.status))}</span>
            </button>`;
    }).join('');
}

function renderFilterInfo() {
    const info = document.getElementById('filter-info');
    info.hidden = !state.filter;
    document.getElementById('filter-name').textContent = state.filter ?? '';
}

function renderIssue(issue, { collapsible }) {
    const status = getStatusOfMilestone(issue.milestone);
    const meta = [`Gemeld ${escapeHtml(formatDateTime(issue.createdAt))}`];
    if (issue.closedAt) {
        meta.push(`${isIncident(status) ? 'Opgelost' : 'Afgerond'} ${escapeHtml(formatDateTime(issue.closedAt))}`);
        if (isIncident(status)) {
            meta.push(`Duur ${escapeHtml(formatDuration(issue.createdAt, issue.closedAt))}`);
        }
    }

    const labels = issue.labels
        .map(label => `<span class="badge label-badge">${escapeHtml(label)}</span>`)
        .join(' ');

    // issue.html is rendered and sanitized by the build script.
    return `
        <article class="card issue status-${getStatusKey(status)}" id="issue-${issue.number}">
            <div class="card-body">
                <h2 class="issue-title">
                    <a target="_blank" rel="noopener" href="${escapeHtml(issue.url)}">
                        <i class="fas ${getStatusIcon(status)} status-icon me-2" aria-hidden="true"></i>${escapeHtml(issue.title)}
                    </a>
                </h2>
                <div class="issue-meta">
                    <span class="badge status-badge">${escapeHtml(getStatusDescription(status))}</span>
                    ${labels}
                    <div class="issue-dates">${meta.join(' &middot; ')}</div>
                </div>
                <div class="issue-body${collapsible ? ' is-collapsible' : ''}">${issue.html}</div>
                ${collapsible ? '<button type="button" class="btn btn-link issue-toggle" aria-expanded="false" hidden>Lees meer</button>' : ''}
            </div>
        </article>`;
}

function renderIssueList(sectionId, issues, emptyText) {
    const list = document.getElementById(`${sectionId}-issues`);
    list.innerHTML = issues.length > 0
        ? issues.map(issue => renderIssue(issue, { collapsible: false })).join('')
        : `<p class="empty-text">${escapeHtml(emptyText)}</p>`;
    document.getElementById(`${sectionId}-count`).textContent = issues.length;
    revealCards(list);
}

function renderPlanned() {
    const issues = state.status.openIssues.filter(issue => isAnnouncement(issue) && matchesFilter(issue));
    document.getElementById('planned-section').hidden = issues.length === 0;
    renderIssueList('planned', issues, '');
}

function renderCurrent() {
    renderIssueList('current', getCurrentIssues().filter(matchesFilter),
        state.filter ? 'Er zijn geen actuele meldingen voor dit onderdeel.' : 'Er zijn geen actuele meldingen.');
}

function renderHistory() {
    const list = document.getElementById('history-issues');
    const previouslyRendered = state.historyRendered;
    state.historyIssues = state.status.closedIssues.filter(matchesFilter);
    state.historyRendered = 0;
    state.historyLastMonth = null;
    list.innerHTML = state.historyIssues.length > 0
        ? ''
        : `<p class="empty-text">${state.filter ? 'Er zijn geen eerdere meldingen voor dit onderdeel.' : 'Er zijn geen eerdere meldingen.'}</p>`;

    do {
        renderNextHistoryBatch();
    } while (state.historyRendered < previouslyRendered && state.historyRendered < state.historyIssues.length);
}

function renderNextHistoryBatch() {
    const list = document.getElementById('history-issues');
    const batch = state.historyIssues.slice(state.historyRendered, state.historyRendered + HISTORY_BATCH_SIZE);

    const html = batch.map(issue => {
        const month = formatMonth(issue.createdAt);
        const header = month !== state.historyLastMonth ? `<h3 class="history-month">${escapeHtml(month)}</h3>` : '';
        state.historyLastMonth = month;
        return header + renderIssue(issue, { collapsible: true });
    }).join('');

    list.insertAdjacentHTML('beforeend', html);
    state.historyRendered += batch.length;

    // Re-observing triggers a fresh intersection check, so the next batch also loads when the
    // sentinel is still in view after this one (a short, filtered list).
    const sentinel = document.getElementById('history-sentinel');
    sentinel.hidden = state.historyRendered >= state.historyIssues.length;
    historyObserver.unobserve(sentinel);
    if (!sentinel.hidden) {
        historyObserver.observe(sentinel);
    }

    revealCards(list);
    list.querySelectorAll('.issue-body.is-collapsible:not([data-checked])').forEach(setUpCollapse);
}

// Only re-render a section when its data changed, so an auto-refresh doesn't replay the fade-in
// or collapse expanded issues.
function renderSection(name, data, render) {
    const signature = JSON.stringify([data, state.filter]);
    if (state.renderedSections[name] !== signature) {
        state.renderedSections[name] = signature;
        render();
    }
}

function render() {
    const { status } = state;
    renderLastUpdated();
    renderFilterInfo();
    renderSection('system', getCurrentIssues().map(issue => issue.milestone), renderSystemStatus);
    renderSection('components', [status.labels, getCurrentIssues()], renderComponents);
    renderSection('planned', status.openIssues, renderPlanned);
    renderSection('current', status.openIssues, renderCurrent);
    renderSection('history', status.closedIssues, renderHistory);
}

// ---------- Behaviour ----------

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const revealObserver = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
    });
}, { rootMargin: '0px 0px -40px 0px' });

function revealCards(container) {
    container.querySelectorAll('.issue:not(.is-visible)').forEach(card => {
        if (prefersReducedMotion.matches) {
            card.classList.add('is-visible');
        } else {
            revealObserver.observe(card);
        }
    });
}

function updateCollapse(body) {
    const toggle = body.nextElementSibling;
    if (body.classList.contains('is-expanded')) {
        return;
    }
    const overflows = body.scrollHeight > COLLAPSED_BODY_HEIGHT + 40;
    body.classList.toggle('is-collapsed', overflows);
    toggle.hidden = !overflows;
}

function setUpCollapse(body) {
    body.dataset.checked = 'true';
    updateCollapse(body);
    // Images without known dimensions only get their height once loaded.
    body.addEventListener('load', () => updateCollapse(body), true);
}

const historyObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && state.historyRendered < state.historyIssues.length) {
        renderNextHistoryBatch();
    }
}, { rootMargin: '600px 0px' });

function readFilterFromHash() {
    return location.hash.startsWith(FILTER_HASH_PREFIX)
        ? decodeURIComponent(location.hash.slice(FILTER_HASH_PREFIX.length))
        : null;
}

function setFilter(filter) {
    state.filter = filter;
    const url = filter ? `${FILTER_HASH_PREFIX}${encodeURIComponent(filter)}` : location.pathname + location.search;
    history.replaceState(null, '', url);
    render();
}

function setUpInteractions() {
    document.getElementById('status-items').addEventListener('click', event => {
        const button = event.target.closest('[data-component]');
        if (button) {
            const name = button.dataset.component;
            setFilter(state.filter === name ? null : name);
        }
    });

    document.getElementById('filter-clear').addEventListener('click', () => setFilter(null));

    document.getElementById('history-issues').addEventListener('click', event => {
        const toggle = event.target.closest('.issue-toggle');
        if (!toggle) {
            return;
        }
        const body = toggle.previousElementSibling;
        const expanded = body.classList.toggle('is-expanded');
        body.classList.toggle('is-collapsed', !expanded);
        toggle.textContent = expanded ? 'Minder tonen' : 'Lees meer';
        toggle.setAttribute('aria-expanded', expanded);
    });

    window.addEventListener('hashchange', () => {
        state.filter = readFilterFromHash();
        render();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - state.lastLoaded >= REFRESH_INTERVAL_MS) {
            loadStatus();
        }
    });

    setInterval(() => {
        if (!document.hidden) {
            loadStatus();
        }
    }, REFRESH_INTERVAL_MS);
}

// ---------- Loading ----------

async function loadStatus() {
    try {
        // 'no-cache' revalidates against GitHub Pages' 10-minute cache, so a new deployment shows up immediately.
        const response = await fetch(STATUS_URL, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`${STATUS_URL} returned ${response.status}`);
        }
        const status = await response.json();
        state.lastLoaded = Date.now();

        if (state.status?.generatedAt !== status.generatedAt) {
            state.status = status;
            render();
        }
    } catch (error) {
        console.error(error);
        // After a successful load, keep showing the last known status instead of an error.
        if (!state.status) {
            renderSystemStatusCard('unknown', 'fa-question', 'De status kon niet worden opgehaald. Probeer het later opnieuw.');
        }
    }
}

state.filter = readFilterFromHash();
setUpInteractions();
loadStatus();
