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

// Severity order for colouring a day in the availability bars.
const INCIDENT_SEVERITY = [StatusEnum.XL, StatusEnum.L, StatusEnum.M, StatusEnum.S];
const DOWNTIME_STATUSES = [StatusEnum.XL, StatusEnum.L];

const STATUS_URL = 'status.json';
const FAVICON_URL = 'images/favicon.svg';
const REFRESH_INTERVAL_MS = 60 * 1000;
const HISTORY_BATCH_SIZE = 10;
const COLLAPSED_BODY_HEIGHT = 240;
const AVAILABILITY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const FILTER_HASH_PREFIX = '#onderdeel=';
const ISSUE_HASH_PATTERN = /^#issue-(\d+)$/;
// The data is rebuilt at least hourly; much older data means publishing has stopped working.
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 200;

const { t } = window.i18n;

const state = {
    status: null,
    filter: null,
    search: '',
    searchTexts: new Map(),
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

function formatDate(isoDate) {
    return new Intl.DateTimeFormat(window.i18n.locale, { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(isoDate));
}

function formatTime(isoDate) {
    return new Intl.DateTimeFormat(window.i18n.locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(isoDate));
}

function formatDateTime(isoDate) {
    return `${formatDate(isoDate)} ${formatTime(isoDate)}`;
}

function formatPeriod(startIso, endIso) {
    if (!endIso) {
        return formatDateTime(startIso);
    }
    const sameDay = formatDate(startIso) === formatDate(endIso);
    return `${formatDateTime(startIso)} – ${sameDay ? formatTime(endIso) : formatDateTime(endIso)}`;
}

function formatRelative(isoDate, now = Date.now()) {
    const minutes = Math.round((Date.parse(isoDate) - now) / 60000);
    const format = new Intl.RelativeTimeFormat(window.i18n.locale, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) {
        return format.format(minutes, 'minute');
    }
    if (Math.abs(minutes) < 48 * 60) {
        return format.format(Math.round(minutes / 60), 'hour');
    }
    return format.format(Math.round(minutes / 1440), 'day');
}

function formatMonth(isoDate) {
    const month = new Intl.DateTimeFormat(window.i18n.locale, { month: 'long', year: 'numeric' })
        .format(new Date(isoDate));
    return month.charAt(0).toUpperCase() + month.slice(1);
}

function formatDuration(fromIso, toIso) {
    const totalMinutes = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days} ${t(days === 1 ? 'duration.day' : 'duration.days')}${hours > 0 ? ` ${hours} ${t('duration.hours')}` : ''}`;
    }
    if (hours > 0) {
        return `${hours} ${t('duration.hours')}${minutes > 0 ? ` ${minutes} ${t('duration.minutes')}` : ''}`;
    }
    return `${minutes} ${t('duration.minutes')}`;
}

function formatPercentage(value) {
    const options = value >= 100 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return `${new Intl.NumberFormat(window.i18n.locale, options).format(Math.min(value, 100))}%`;
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
        case StatusEnum.XL:
            return 'XL';
        case StatusEnum.L:
            return 'L';
        case StatusEnum.M:
            return 'M';
        case StatusEnum.S:
            return 'S';
        default:
            return t(`milestone.${Object.keys(StatusEnum).find(key => StatusEnum[key] === status) ?? 'Unknown'}`);
    }
}

function getSystemStatusText(status) {
    switch (status) {
        case StatusEnum.Maintenance:
            return t('status.maintenance');
        case StatusEnum.XL:
            return t('status.xl');
        case StatusEnum.L:
        case StatusEnum.M:
        case StatusEnum.S:
            return t('status.disruption');
        case StatusEnum.UnderInvestigation:
            return t('status.investigation');
        default:
            return t('status.ok');
    }
}

// Maintenance and announcements are typically opened in advance, so their open time is no outage duration.
function isIncident(status) {
    return [...INCIDENT_SEVERITY, StatusEnum.UnderInvestigation].includes(status);
}

function isInScheduledWindow(issue, now = Date.now()) {
    return !!issue.startAt && Date.parse(issue.startAt) <= now && (!issue.endAt || now < Date.parse(issue.endAt));
}

// An announcement counts as maintenance during its scheduled window, so nobody has to switch the
// milestone at the exact start time.
function getEffectiveMilestone(issue) {
    return getStatusOfMilestone(issue.milestone) === StatusEnum.Announcement && isInScheduledWindow(issue)
        ? 'Maintenance'
        : issue.milestone;
}

function getIssueStatus(issue) {
    return getStatusOfMilestone(getEffectiveMilestone(issue));
}

function isAnnouncement(issue) {
    return getIssueStatus(issue) === StatusEnum.Announcement;
}

function matchesFilter(issue) {
    return !state.filter || issue.labels.includes(state.filter);
}

function getSearchText(issue) {
    if (!state.searchTexts.has(issue.number)) {
        const container = document.createElement('div');
        container.innerHTML = [issue.html, issue.analysis ?? '', ...issue.updates.map(update => update.html)].join(' ');
        state.searchTexts.set(issue.number, `${issue.title} ${issue.labels.join(' ')} ${container.textContent}`.toLowerCase());
    }
    return state.searchTexts.get(issue.number);
}

function matchesSearch(issue) {
    const terms = state.search.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term => getSearchText(issue).includes(term));
}

function getCurrentIssues() {
    return state.status.openIssues.filter(issue => !isAnnouncement(issue));
}

function buildComponents() {
    const currentIssues = getCurrentIssues();
    return state.status.labels.map(name => {
        const milestones = [...new Set(currentIssues
            .filter(issue => issue.labels.includes(name))
            .map(getEffectiveMilestone))];
        return { name, status: getStatusOfMilestones(milestones) };
    });
}

// ---------- Availability ----------

function getAvailabilityDays(now) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: AVAILABILITY_DAYS }, (_, index) => {
        const start = new Date(today);
        start.setDate(today.getDate() - (AVAILABILITY_DAYS - 1 - index));
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return { start: start.getTime(), end: end.getTime() };
    });
}

function getIncidentSpan(incident, now) {
    return { start: Date.parse(incident.startAt), end: incident.endAt ? Date.parse(incident.endAt) : now };
}

function getDowntimeMs(incidents, periodStart, now) {
    const spans = incidents
        .filter(incident => DOWNTIME_STATUSES.includes(getStatusOfMilestone(incident.milestone)))
        .map(incident => getIncidentSpan(incident, now))
        .map(span => ({ start: Math.max(span.start, periodStart), end: Math.min(span.end, now) }))
        .filter(span => span.end > span.start)
        .sort((a, b) => a.start - b.start);

    let total = 0;
    let current = null;
    spans.forEach(span => {
        if (current && span.start <= current.end) {
            current.end = Math.max(current.end, span.end);
        } else {
            if (current) {
                total += current.end - current.start;
            }
            current = { ...span };
        }
    });
    return total + (current ? current.end - current.start : 0);
}

function buildAvailability() {
    const now = Date.now();
    const days = getAvailabilityDays(now);
    const periodStart = days[0].start;
    const incidents = state.status.availability?.incidents ?? [];

    return state.status.labels.map(name => {
        const componentIncidents = incidents.filter(incident => incident.labels.includes(name));
        const bars = days.map(day => {
            const dayIncidents = componentIncidents.filter(incident => {
                const span = getIncidentSpan(incident, now);
                return span.start < day.end && span.end > day.start;
            });
            const statuses = dayIncidents.map(incident => getStatusOfMilestone(incident.milestone));
            const worst = INCIDENT_SEVERITY.find(status => statuses.includes(status)) ?? StatusEnum.Online;
            const titles = dayIncidents.map(incident => `${incident.title} (${incident.milestone})`);
            return { day, status: worst, titles };
        });
        const uptime = 100 * (1 - getDowntimeMs(componentIncidents, periodStart, now) / (now - periodStart));
        return { name, bars, uptime, incidentCount: componentIncidents.length };
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

let faviconBase;

// The AO plus with, when something is going on, a dot with an exclamation mark in the status colour
// in the bottom-right corner (coordinates match the viewBox of images/favicon.svg).
async function renderFavicon(status) {
    const favicon = document.getElementById('favicon');
    if (status === StatusEnum.Online) {
        favicon.href = FAVICON_URL;
        return;
    }

    const colors = { xl: ['#d51c00', '#fff'], l: ['#fe9c39', '#212529'], m: ['#fe9c39', '#212529'], s: ['#1b7d80', '#fff'] };
    const [fill, mark] = colors[getStatusKey(status)] ?? ['#495057', '#fff'];
    const dot = `<circle cx="154" cy="77" r="25" fill="${fill}" stroke="#fff" stroke-width="6"/>`
        + `<rect x="150.5" y="61" width="7" height="20" rx="3.5" fill="${mark}"/><circle cx="154" cy="90" r="4" fill="${mark}"/>`;

    try {
        faviconBase ??= await fetch(FAVICON_URL).then(response => response.text());
        favicon.href = `data:image/svg+xml,${encodeURIComponent(faviconBase.replace('</svg>', `${dot}</svg>`))}`;
    } catch (error) {
        console.error(error);
    }
}

function renderSystemStatus() {
    const status = getStatusOfMilestones(getCurrentIssues().map(getEffectiveMilestone));
    renderSystemStatusCard(getStatusKey(status), getStatusIcon(status), getSystemStatusText(status));
    renderFavicon(status);
}

function renderLastUpdated() {
    document.getElementById('last-updated').textContent = formatDateTime(state.status.generatedAt);
}

function renderStaleWarning() {
    const warning = document.getElementById('stale-warning');
    const stale = Date.now() - Date.parse(state.status.generatedAt) > STALE_AFTER_MS;
    warning.hidden = !stale;
    if (stale) {
        warning.querySelector('span').textContent = t('stale.warning', { date: formatDateTime(state.status.generatedAt) });
    }
}

function updateCountdowns() {
    document.querySelectorAll('[data-starts-at]').forEach(element => {
        element.textContent = t('schedule.startsIn', { relative: formatRelative(element.dataset.startsAt) });
    });
}

function renderComponents() {
    document.getElementById('status-items').innerHTML = buildComponents().map(component => {
        const key = getStatusKey(component.status);
        const selected = state.filter === component.name;

        return `
            <button type="button" class="list-group-item list-group-item-action component status-${key}${selected ? ' is-selected' : ''}"
                data-component="${escapeHtml(component.name)}" aria-pressed="${selected}"
                title="${escapeHtml(t(selected ? 'component.clearFilter' : 'component.filter'))}">
                <span>
                    <i class="fas ${getStatusIcon(component.status)} status-icon me-2" aria-hidden="true"></i>
                    ${escapeHtml(component.name)}
                </span>
                <span class="status-text">${escapeHtml(getStatusDescription(component.status))}</span>
            </button>`;
    }).join('');
}

function renderAvailability() {
    const components = buildAvailability();
    const total = state.status.availability?.incidents.length ?? 0;
    document.getElementById('availability-summary').textContent =
        total === 0 ? t('availability.none') : t(total === 1 ? 'availability.countOne' : 'availability.countMany', { count: total });

    document.getElementById('availability-list').innerHTML = components.map(component => {
        const bars = component.bars.map(bar => {
            const title = `${formatDate(bar.day.start)}: ${bar.titles.length > 0 ? bar.titles.join(', ') : t('availability.none')}`;
            return `<span class="availability-bar status-${getStatusKey(bar.status)}" title="${escapeHtml(title)}"></span>`;
        }).join('');

        return `
            <li class="availability-row">
                <div class="availability-header">
                    <span>${escapeHtml(component.name)}</span>
                    <span class="availability-uptime">${escapeHtml(t('availability.uptime', { percentage: formatPercentage(component.uptime) }))}</span>
                </div>
                <div class="availability-bars" aria-hidden="true">${bars}</div>
            </li>`;
    }).join('');
}

function renderFilterInfo() {
    document.getElementById('filter-info').hidden = !state.filter;
    document.getElementById('filter-name').textContent = state.filter ?? '';
}

function renderUpdates(issue) {
    if (issue.updates.length === 0) {
        return '';
    }

    // Newest first; update html is rendered and sanitized by the build script.
    const items = [...issue.updates].reverse().map(update => `
        <li class="issue-update">
            <time datetime="${escapeHtml(update.createdAt)}">${escapeHtml(formatDateTime(update.createdAt))}</time>
            <div>${update.html}</div>
        </li>`).join('');

    return `
        <h3 class="issue-section-title">${escapeHtml(t('issue.updates'))}</h3>
        <ol class="issue-updates">${items}</ol>
        <h3 class="issue-section-title">${escapeHtml(t('issue.description'))}</h3>`;
}

function getIssueMeta(issue, status) {
    if (!issue.closedAt && issue.startAt && status === StatusEnum.Announcement) {
        return [t('schedule.planned', { period: formatPeriod(issue.startAt, issue.endAt) })];
    }
    if (!issue.closedAt && issue.startAt && status === StatusEnum.Maintenance && isInScheduledWindow(issue)) {
        return [issue.endAt ? t('schedule.until', { time: formatTime(issue.endAt) }) : t('schedule.started', { date: formatDateTime(issue.startAt) })];
    }

    // For incidents, a start/end time written in the issue is more accurate than when it was opened/closed.
    const incident = isIncident(status);
    const start = incident && issue.startAt ? issue.startAt : issue.createdAt;
    const end = incident && issue.endAt ? issue.endAt : issue.closedAt;
    const meta = [];
    if (start !== issue.createdAt) {
        meta.push(t('issue.started', { date: formatDateTime(start) }));
    }
    meta.push(t('issue.reported', { date: formatDateTime(issue.createdAt) }));

    if (issue.closedAt) {
        meta.push(t(incident ? 'issue.resolved' : 'issue.completed', { date: formatDateTime(end) }));
        if (incident) {
            meta.push(t('issue.duration', { duration: formatDuration(start, end) }));
        }
    } else if (Date.parse(issue.lastUpdateAt) - Date.parse(issue.createdAt) > 60 * 1000) {
        meta.push(t('issue.lastUpdate', { date: formatDateTime(issue.lastUpdateAt) }));
    }
    return meta;
}

function renderAnalysis(issue) {
    // The analysis html is rendered and sanitized by the build script.
    return issue.analysis
        ? `<section class="issue-analysis"><h3 class="issue-section-title">${escapeHtml(t('issue.analysis'))}</h3>${issue.analysis}</section>`
        : '';
}

function renderIssue(issue, { collapsible }) {
    const status = getIssueStatus(issue);
    const meta = getIssueMeta(issue, status).map(escapeHtml);
    const upcoming = !issue.closedAt && status === StatusEnum.Announcement && issue.startAt && Date.parse(issue.startAt) > Date.now();
    if (upcoming) {
        meta.push(`<span class="countdown" data-starts-at="${escapeHtml(issue.startAt)}"></span>`);
    }

    const labels = issue.labels
        .map(label => `<span class="badge label-badge">${escapeHtml(label)}</span>`)
        .join(' ');

    // issue.html is rendered and sanitized by the build script.
    return `
        <article class="card issue status-${getStatusKey(status)}" id="issue-${issue.number}">
            <div class="card-body">
                <div class="issue-heading">
                    <h2 class="issue-title">
                        <a target="_blank" rel="noopener" href="${escapeHtml(issue.url)}">
                            <i class="fas ${getStatusIcon(status)} status-icon me-2" aria-hidden="true"></i>${escapeHtml(issue.title)}
                        </a>
                    </h2>
                    <a class="issue-permalink" href="#issue-${issue.number}" title="${escapeHtml(t('issue.permalink'))}"
                        aria-label="${escapeHtml(t('issue.permalink'))}"><i class="fas fa-link" aria-hidden="true"></i></a>
                </div>
                <div class="issue-meta">
                    <span class="badge status-badge">${escapeHtml(getStatusDescription(status))}</span>
                    ${labels}
                    <div class="issue-dates">${meta.join(' &middot; ')}</div>
                </div>
                <div class="issue-body${collapsible ? ' is-collapsible' : ''}">${renderAnalysis(issue)}${renderUpdates(issue)}${issue.html}</div>
                ${collapsible ? `<button type="button" class="btn btn-link issue-toggle" aria-expanded="false" hidden>${escapeHtml(t('issue.readMore'))}</button>` : ''}
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
        t(state.filter ? 'empty.currentFiltered' : 'empty.current'));
}

function renderHistory() {
    const list = document.getElementById('history-issues');
    const previouslyRendered = state.historyRendered;
    state.historyIssues = state.status.closedIssues.filter(issue => matchesFilter(issue) && matchesSearch(issue));
    state.historyRendered = 0;
    state.historyLastMonth = null;

    let emptyText = t(state.filter ? 'empty.historyFiltered' : 'empty.history');
    if (state.search.trim()) {
        emptyText = t('empty.search', { query: state.search.trim() });
    }
    list.innerHTML = state.historyIssues.length > 0 ? '' : `<p class="empty-text">${escapeHtml(emptyText)}</p>`;

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
    const signature = JSON.stringify([data, state.filter, window.i18n.language]);
    if (state.renderedSections[name] !== signature) {
        state.renderedSections[name] = signature;
        render();
    }
}

function render() {
    const { status } = state;
    // Effective milestones change when a scheduled maintenance window starts or ends.
    const openState = [status.openIssues, status.openIssues.map(getEffectiveMilestone)];
    renderLastUpdated();
    renderStaleWarning();
    renderFilterInfo();
    renderSection('system', getCurrentIssues().map(getEffectiveMilestone), renderSystemStatus);
    renderSection('components', [status.labels, openState], renderComponents);
    renderSection('availability', [status.labels, status.availability, new Date().toDateString()], renderAvailability);
    renderSection('planned', openState, renderPlanned);
    renderSection('current', openState, renderCurrent);
    renderSection('history', [status.closedIssues, state.search], renderHistory);
    updateCountdowns();
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

function setExpanded(body, expanded) {
    const toggle = body.nextElementSibling;
    body.classList.toggle('is-expanded', expanded);
    body.classList.toggle('is-collapsed', !expanded);
    toggle.textContent = t(expanded ? 'issue.readLess' : 'issue.readMore');
    toggle.setAttribute('aria-expanded', expanded);
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

// Opens a direct link (#issue-123): renders history batches until the issue is there, then scrolls to it.
function showLinkedIssue() {
    const match = ISSUE_HASH_PATTERN.exec(location.hash);
    if (!match || !state.status) {
        return;
    }

    const number = Number(match[1]);
    const exists = [...state.status.openIssues, ...state.status.closedIssues].some(issue => issue.number === number);
    if (!exists) {
        return;
    }
    if (state.filter || state.search) {
        state.filter = null;
        state.search = '';
        document.getElementById('history-search').value = '';
        render();
    }

    const historyIndex = state.historyIssues.findIndex(issue => issue.number === number);
    while (historyIndex >= state.historyRendered && state.historyRendered < state.historyIssues.length) {
        renderNextHistoryBatch();
    }

    const card = document.getElementById(`issue-${number}`);
    card.classList.add('is-visible', 'is-highlighted');
    const body = card.querySelector('.issue-body.is-collapsed');
    if (body) {
        setExpanded(body, true);
    }
    // Bootstrap enables smooth scrolling, which stops short while lazily rendered cards change height.
    card.scrollIntoView({ block: 'start', behavior: 'instant' });
    setTimeout(() => card.classList.remove('is-highlighted'), 2500);
}

function handleHashChange() {
    if (ISSUE_HASH_PATTERN.test(location.hash)) {
        showLinkedIssue();
        return;
    }
    state.filter = readFilterFromHash();
    render();
}

function setUpInteractions() {
    let searchTimer;
    document.getElementById('history-search').addEventListener('input', event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = event.target.value;
            if (state.status) {
                render();
            }
        }, SEARCH_DEBOUNCE_MS);
    });

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
        if (toggle) {
            const body = toggle.previousElementSibling;
            setExpanded(body, !body.classList.contains('is-expanded'));
        }
    });

    window.addEventListener('hashchange', handleHashChange);

    window.i18n.onChange(() => {
        if (state.status) {
            render();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - state.lastLoaded >= REFRESH_INTERVAL_MS) {
            loadStatus();
        }
    });

    // Also re-render with unchanged data: countdowns, maintenance windows and the stale check depend on the time.
    setInterval(async () => {
        if (!document.hidden) {
            await loadStatus();
            if (state.status) {
                render();
            }
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
            const firstLoad = !state.status;
            state.status = status;
            state.searchTexts.clear();
            render();
            if (firstLoad) {
                showLinkedIssue();
            }
        }
    } catch (error) {
        console.error(error);
        // After a successful load, keep showing the last known status instead of an error.
        if (!state.status) {
            renderSystemStatusCard('unknown', 'fa-question', t('status.error'));
        }
    }
}

state.filter = readFilterFromHash();
setUpInteractions();
loadStatus();
