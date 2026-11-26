import createDOMPurify from 'dompurify';
import { marked } from 'marked';

export const MAX_IMAGE_HEIGHT = 400;
export const INCIDENT_MILESTONES = ['xl', 'l', 'm', 's'];

// Anyone can open an issue on the public repository, but only collaborators can set a milestone,
// so issues without a milestone are never published.
export function isPublishedIssue(issue) {
    return !issue.pull_request && !!issue.milestone;
}

export function isIncident(issue) {
    return INCIDENT_MILESTONES.includes(issue.milestone?.title.toLowerCase());
}

// Comments can also be written by anyone. Only comments by people who authored a published issue
// (and therefore belong to the team) are shown.
export function getTeamLogins(issues) {
    return new Set(issues.filter(isPublishedIssue).map(issue => issue.user.login));
}

export function createRenderer(window) {
    const DOMPurify = createDOMPurify(window);

    // GitHub stores pasted screenshots as <img width height> at their full size; scale them down to fit
    // MAX_IMAGE_HEIGHT and link to the full-size image. Together with `height: auto` in the stylesheet the
    // attributes keep the aspect ratio when the image is narrowed further, without inline styles (CSP).
    function fitImages(container) {
        container.querySelectorAll('img').forEach(image => {
            const width = Number(image.getAttribute('width'));
            const height = Number(image.getAttribute('height'));
            image.removeAttribute('style');
            image.setAttribute('loading', 'lazy');
            image.setAttribute('class', 'issue-image');

            if (width > 0 && height > 0) {
                const scale = Math.min(1, MAX_IMAGE_HEIGHT / height);
                image.setAttribute('width', String(Math.round(width * scale)));
                image.setAttribute('height', String(Math.round(height * scale)));
            } else {
                image.removeAttribute('width');
                image.removeAttribute('height');
            }

            if (!image.closest('a')) {
                const link = container.ownerDocument.createElement('a');
                link.setAttribute('href', image.getAttribute('src'));
                image.replaceWith(link);
                link.append(image);
            }
        });
    }

    return function renderMarkdown(markdown) {
        const container = window.document.createElement('div');
        container.innerHTML = DOMPurify.sanitize(marked.parse(markdown ?? '', { gfm: true, breaks: true }));
        fitImages(container);
        container.querySelectorAll('a[href]').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener');
        });
        return container.innerHTML;
    };
}

const TIME_ZONE = 'Europe/Amsterdam';
const SCHEDULE_PATTERN = /\b(start|begin|eind|einde|end)\s*:\s*(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})-(\d{1,2})-(\d{4}))[ T]+(\d{1,2})[:.](\d{2})/gi;
const ANALYSIS_PATTERN = /^\s*#{1,6}\s*(analyse|analysis)\b/i;

function getTimeZoneOffsetMs(timestamp) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).formatToParts(timestamp).map(part => [part.type, Number(part.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(timestamp / 60000) * 60000;
}

// Converts a Dutch wall-clock time (as written in an issue) to an ISO timestamp, including summer time.
export function amsterdamTimeToIso(year, month, day, hour, minute) {
    const wallClock = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = wallClock - getTimeZoneOffsetMs(wallClock);
    timestamp = wallClock - getTimeZoneOffsetMs(timestamp);
    return new Date(timestamp).toISOString();
}

// Reads a planned or actual start/end time from HTML comments in the issue text, for example
// <!-- start: 2026-12-03 11:30, eind: 2026-12-03 12:00 -->. Comments are invisible on GitHub and the status page.
export function parseSchedule(markdown) {
    const schedule = { startAt: null, endAt: null };
    for (const [, comment] of (markdown ?? '').matchAll(/<!--([\s\S]*?)-->/g)) {
        for (const match of comment.matchAll(SCHEDULE_PATTERN)) {
            const [, key, isoYear, isoMonth, isoDay, dutchDay, dutchMonth, dutchYear, hour, minute] = match;
            const iso = amsterdamTimeToIso(Number(isoYear ?? dutchYear), Number(isoMonth ?? dutchMonth),
                Number(isoDay ?? dutchDay), Number(hour), Number(minute));
            schedule[['start', 'begin'].includes(key.toLowerCase()) ? 'startAt' : 'endAt'] = iso;
        }
    }
    return schedule;
}

const TITLE_SCHEDULE_PATTERN = /(\d{1,2})-(\d{1,2})-(\d{4})\s+om\s+(\d{1,2})[:.](\d{2})/i;
const TITLE_SCHEDULE_DURATION_MS = 30 * 60 * 1000;

// Release announcements are titled "Release 2026.15 op 26-11-2026 om 11:30"; without a start time in a
// comment, that time is used with the usual release duration.
export function getSchedule(issue) {
    const schedule = parseSchedule(issue.body);
    const milestone = issue.milestone?.title.toLowerCase();
    if (!schedule.startAt && ['announcement', 'maintenance'].includes(milestone)) {
        const match = TITLE_SCHEDULE_PATTERN.exec(issue.title);
        if (match) {
            const [, day, month, year, hour, minute] = match.map(Number);
            schedule.startAt = amsterdamTimeToIso(year, month, day, hour, minute);
            schedule.endAt ??= new Date(Date.parse(schedule.startAt) + TITLE_SCHEDULE_DURATION_MS).toISOString();
        }
    }
    return schedule;
}

function isAnalysis(comment) {
    return ANALYSIS_PATTERN.test(comment.body ?? '');
}

export function toPublicIssue(issue, comments, teamLogins, renderMarkdown) {
    const teamComments = comments.filter(comment => teamLogins.has(comment.user.login));
    const updates = teamComments
        .filter(comment => !isAnalysis(comment))
        .map(comment => ({ createdAt: comment.created_at, html: renderMarkdown(comment.body) }));
    const analysis = teamComments.filter(isAnalysis).at(-1);

    return {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        lastUpdateAt: updates.at(-1)?.createdAt ?? issue.updated_at,
        ...getSchedule(issue),
        milestone: issue.milestone.title,
        labels: issue.labels.map(label => label.name),
        html: renderMarkdown(issue.body),
        updates,
        analysis: analysis ? renderMarkdown(analysis.body.replace(ANALYSIS_PATTERN, '').replace(/^[^\n]*\n?/, '')) : null
    };
}

// Incidents overlapping the availability period, without content: the page only needs their time span.
// A start/end time written in the issue takes precedence over the time it was opened/closed.
export function toIncidents(issues, since) {
    return issues
        .filter(issue => isPublishedIssue(issue) && isIncident(issue))
        .map(issue => {
            const schedule = parseSchedule(issue.body);
            return {
                number: issue.number,
                title: issue.title,
                milestone: issue.milestone.title,
                labels: issue.labels.map(label => label.name),
                startAt: schedule.startAt ?? issue.created_at,
                endAt: schedule.endAt ?? issue.closed_at
            };
        })
        .filter(incident => !incident.endAt || incident.endAt >= since);
}

// Same rules as the page: announcements don't count, except during their scheduled window,
// when they count as maintenance.
export function getEffectiveMilestone(issue, now) {
    const milestone = issue.milestone.toLowerCase();
    if (milestone === 'announcement' && issue.startAt && Date.parse(issue.startAt) <= now
        && (!issue.endAt || now < Date.parse(issue.endAt))) {
        return 'maintenance';
    }
    return milestone;
}

const STATUS_PRIORITY = ['maintenance', 'xl', 'l', 'm', 's', 'under investigation'];

export function getSystemStatus(openIssues, now) {
    const milestones = openIssues.map(issue => getEffectiveMilestone(issue, now)).filter(milestone => milestone !== 'announcement');
    if (milestones.length === 0) {
        return 'operational';
    }
    return STATUS_PRIORITY.find(status => milestones.includes(status)) ?? 'unknown';
}

const BADGES = {
    operational: { text: 'operationeel', color: '#1a7f32' },
    maintenance: { text: 'onderhoud', color: '#1b7d80' },
    xl: { text: 'ernstige storing', color: '#d51c00' },
    l: { text: 'storing', color: '#b35900' },
    m: { text: 'storing', color: '#b35900' },
    s: { text: 'kleine storing', color: '#1b7d80' },
    'under investigation': { text: 'onderzoek', color: '#495057' },
    unknown: { text: 'onbekend', color: '#495057' }
};

// A small status badge in the style of shields.io, for embedding on other sites.
export function buildBadge(systemStatus) {
    const label = 'AO status';
    const { text, color } = BADGES[systemStatus];
    const textWidth = value => Math.round(value.length * 6.6) + 12;
    const labelWidth = textWidth(label);
    const valueWidth = textWidth(text);
    const width = labelWidth + valueWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${text}">
  <title>${label}: ${text}</title>
  <clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${text}</text>
  </g>
</svg>
`;
}

function formatIcsDate(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcsText(value) {
    return String(value).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
}

// iCalendar lines may be at most 75 octets; longer lines continue on the next line after a space.
function foldIcsLine(line) {
    const chunks = [];
    let current = '';
    for (const character of line) {
        if (Buffer.byteLength(current + character) > (chunks.length === 0 ? 75 : 74)) {
            chunks.push(current);
            current = '';
        }
        current += character;
    }
    chunks.push(current);
    return chunks.join('\r\n ');
}

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

// Calendar subscription with the scheduled releases and maintenance that have a start time.
export function buildCalendar(status, siteUrl) {
    const events = [...status.openIssues, ...status.closedIssues]
        .filter(issue => issue.startAt && ['announcement', 'maintenance'].includes(issue.milestone.toLowerCase()))
        .map(issue => {
            const end = issue.endAt ?? new Date(Date.parse(issue.startAt) + DEFAULT_EVENT_DURATION_MS).toISOString();
            const url = `${siteUrl}#issue-${issue.number}`;
            return [
                'BEGIN:VEVENT',
                `UID:issue-${issue.number}@${new URL(siteUrl).host}`,
                `DTSTAMP:${formatIcsDate(status.generatedAt)}`,
                `DTSTART:${formatIcsDate(issue.startAt)}`,
                `DTEND:${formatIcsDate(end)}`,
                `SUMMARY:${escapeIcsText(issue.title)}`,
                `DESCRIPTION:${escapeIcsText(`Details en updates: ${url}`)}`,
                `URL:${url}`,
                'END:VEVENT'
            ];
        });

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Assistance Online//Statuspagina//NL',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Assistance Online - Releases en onderhoud',
        `X-WR-TIMEZONE:${TIME_ZONE}`,
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
        ...events.flat(),
        'END:VCALENDAR'
    ].map(foldIcsLine).join('\r\n') + '\r\n';
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function buildFeed(status, siteUrl, size) {
    const issues = [...status.openIssues, ...status.closedIssues]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, size);

    const entries = issues.map(issue => {
        const updates = [...issue.updates].reverse().map(update => update.html).join('<hr>');
        const content = updates ? `${updates}<hr>${issue.html}` : issue.html;
        const updated = [issue.updatedAt, issue.lastUpdateAt].sort().at(-1);
        return `
  <entry>
    <id>${escapeXml(issue.url)}</id>
    <title>${escapeXml(`${issue.closedAt ? '[Opgelost] ' : ''}${issue.title}`)}</title>
    <link href="${escapeXml(`${siteUrl}#issue-${issue.number}`)}"/>
    <published>${issue.createdAt}</published>
    <updated>${updated}</updated>
    ${issue.labels.map(label => `<category term="${escapeXml(label)}"/>`).join('')}
    <content type="html">${escapeXml(content)}</content>
  </entry>`;
    }).join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="nl">
  <id>${siteUrl}</id>
  <title>Assistance Online - Status</title>
  <link href="${siteUrl}"/>
  <link rel="self" href="${siteUrl}feed.xml"/>
  <updated>${status.generatedAt}</updated>
  <author><name>Assistance Online</name></author>${entries}
</feed>
`;
}
