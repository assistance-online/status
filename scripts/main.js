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

// Highest priority first: the overall status is the first one present among the open issues.
const STATUS_PRIORITY = [
    StatusEnum.Maintenance,
    StatusEnum.XL,
    StatusEnum.L,
    StatusEnum.M,
    StatusEnum.S,
    StatusEnum.UnderInvestigation,
    StatusEnum.Announcement
];

const STATUS_URL = 'status.json';
const MAX_IMAGE_HEIGHT = 400;

const markdownConverter = new showdown.Converter();
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}

// GitHub stores pasted screenshots as <img width height> at their full size; scale them down to fit
// MAX_IMAGE_HEIGHT while keeping the aspect ratio, and link to the full-size image.
function fitImages(container) {
    container.querySelectorAll('img').forEach(image => {
        const width = Number(image.getAttribute('width'));
        const height = Number(image.getAttribute('height'));
        image.removeAttribute('width');
        image.removeAttribute('height');
        image.loading = 'lazy';
        image.classList.add('issue-image');

        if (width > 0 && height > 0) {
            image.style.width = `${Math.min(width, MAX_IMAGE_HEIGHT * width / height)}px`;
            image.style.aspectRatio = `${width} / ${height}`;
        }

        if (!image.closest('a')) {
            const link = document.createElement('a');
            link.href = image.src;
            link.target = '_blank';
            link.rel = 'noopener';
            image.replaceWith(link);
            link.append(image);
        }
    });
}

function renderMarkdown(markdown) {
    const container = document.createElement('div');
    container.innerHTML = DOMPurify.sanitize(markdownConverter.makeHtml(markdown ?? ''));
    fitImages(container);
    return container.innerHTML;
}

function getStatusBasedOnIssueMilestone(milestone) {
    if (!milestone) {
        return StatusEnum.Unknown;
    }

    switch (milestone.title.toLowerCase()) {
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

function getStatusBasedOnIssueMilestones(milestones) {
    if (milestones.length === 0) {
        return StatusEnum.Online;
    }

    const statuses = milestones.map(getStatusBasedOnIssueMilestone);
    return STATUS_PRIORITY.find(status => statuses.includes(status)) ?? StatusEnum.Unknown;
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

function getBackgroundColorClass(status) {
    switch (status) {
        case StatusEnum.Online:
            return 'bg-success';
        case StatusEnum.XL:
            return 'bg-danger';
        case StatusEnum.L:
        case StatusEnum.M:
            return 'bg-warning';
        case StatusEnum.S:
            return 'bg-info';
        default:
            return 'bg-dark';
    }
}

function getTextColorClass(status) {
    switch (status) {
        case StatusEnum.Online:
            return 'text-success';
        case StatusEnum.XL:
            return 'text-danger';
        case StatusEnum.L:
        case StatusEnum.M:
            return 'text-warning';
        case StatusEnum.S:
            return 'text-info';
        default:
            return 'text-dark';
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
        case StatusEnum.Announcement:
            return 'Nieuwe aankondiging';
        default:
            return 'Momenteel zijn er geen actuele verstoringen bekend.';
    }
}

function renderSystemStatusCard(backgroundColorClass, iconClass, text) {
    document.getElementById('system-status').innerHTML = `
        <div class="row g-0">
            <div class="col-sm-1 ${backgroundColorClass}">
                <div class="card-body text-center align-middle text-white">
                    <i class="fas ${iconClass} fa-lg"></i>
                </div>
            </div>
            <div class="col-sm-11">
                <div class="card-body align-middle">
                    <h5 class="card-title mb-0">${escapeHtml(text)}</h5>
                </div>
            </div>
        </div>`;
}

function renderSystemStatus(items) {
    const status = getStatusBasedOnIssueMilestones(items.flatMap(item => item.milestones));
    renderSystemStatusCard(getBackgroundColorClass(status), getStatusIcon(status), getSystemStatusText(status));
}

function renderStatusItems(items) {
    document.getElementById('status-items').innerHTML = items.map(item => {
        const status = getStatusBasedOnIssueMilestones(item.milestones);
        const textColorClass = getTextColorClass(status);

        return `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>
                    <i class="fas ${getStatusIcon(status)} ${textColorClass} me-2"></i>
                    ${escapeHtml(item.name)}
                </span>
                <span class="badge rounded-pill ${textColorClass}">${escapeHtml(getStatusDescription(status))}</span>
            </li>`;
    }).join('');
}

function renderIssues(elementId, issues) {
    document.getElementById(elementId).innerHTML = issues.map(issue => {
        const status = getStatusBasedOnIssueMilestone(issue.milestone);
        const milestoneHtml = `<span class="badge ${getBackgroundColorClass(status)} text-white">${escapeHtml(issue.milestone.title)}</span>`;
        const labelsHtml = issue.labels
            .map(label => `<span class="badge bg-dark text-white">${escapeHtml(label.name)}</span>`)
            .join(' ');

        return `
            <dt>
                <a target="_blank" rel="noopener" href="${escapeHtml(issue.html_url)}">
                    <h2>
                        <i class="fas ${getStatusIcon(status)} me-2"></i>
                        ${escapeHtml(issue.title)}
                    </h2>
                </a>
            </dt>
            <dd>
                <small>${escapeHtml(formatDate(issue.created_at))}</small>
                ${milestoneHtml} ${labelsHtml}
                <br>${renderMarkdown(issue.body)}
                <hr>
            </dd>`;
    }).join('');
}

function buildStatusItems(labels, openIssues) {
    const items = labels.map(name => ({ name, milestones: [] }));

    openIssues.forEach(issue => {
        issue.labels.forEach(label => {
            const item = items.find(x => x.name === label.name);
            if (item && !item.milestones.some(milestone => milestone.title === issue.milestone.title)) {
                item.milestones.push(issue.milestone);
            }
        });
    });

    return items;
}

async function loadStatus() {
    try {
        // 'no-cache' revalidates against GitHub Pages' 10-minute cache, so a new deployment shows up immediately.
        const response = await fetch(STATUS_URL, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`${STATUS_URL} returned ${response.status}`);
        }
        const { labels, openIssues, closedIssues } = await response.json();
        const items = buildStatusItems(labels, openIssues);

        renderIssues('open-issues', openIssues);
        renderIssues('closed-issues', closedIssues);
        renderStatusItems(items);
        renderSystemStatus(items);
        document.getElementById('open-issues-count').textContent = openIssues.length;
    } catch (error) {
        console.error(error);
        renderSystemStatusCard('bg-dark', 'fa-question', 'De status kon niet worden opgehaald. Probeer het later opnieuw.');
    }
}

loadStatus();
