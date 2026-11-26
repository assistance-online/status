import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
    amsterdamTimeToIso, buildBadge, buildCalendar, buildFeed, createRenderer, getSchedule, getSystemStatus, getTeamLogins,
    isPublishedIssue, parseSchedule, toIncidents, toPublicIssue
} from '../lib.mjs';

const renderMarkdown = createRenderer(new JSDOM('').window);

function githubIssue(overrides = {}) {
    return {
        number: 1,
        title: 'Storing',
        html_url: 'https://github.com/assistance-online/status/issues/1',
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-01T10:00:00Z',
        closed_at: null,
        milestone: { title: 'XL' },
        labels: [{ name: 'AO api' }],
        user: { login: 'team-member' },
        body: 'Tekst',
        comments: 0,
        ...overrides
    };
}

describe('isPublishedIssue', () => {
    it('publishes only issues with a milestone', () => {
        assert.equal(isPublishedIssue(githubIssue()), true);
        assert.equal(isPublishedIssue(githubIssue({ milestone: null })), false);
    });

    it('never publishes pull requests', () => {
        assert.equal(isPublishedIssue(githubIssue({ pull_request: {} })), false);
    });
});

describe('renderMarkdown', () => {
    it('removes scripts, event handlers and javascript links', () => {
        const html = renderMarkdown('<script>alert(1)</script><img src="x" onerror="alert(1)">\n\n[link](javascript:alert(1))');
        assert.doesNotMatch(html, /<script|onerror|href="javascript:/);
    });

    it('scales large screenshots to at most 400px high and keeps the ratio', () => {
        const html = renderMarkdown('<img width="1700" height="1093" src="https://github.com/a.png">');
        const image = JSDOM.fragment(html).querySelector('img');
        assert.equal(image.getAttribute('height'), '400');
        assert.equal(image.getAttribute('width'), '622');
        assert.equal(image.getAttribute('loading'), 'lazy');
        assert.equal(image.parentElement.tagName, 'A');
        assert.equal(image.parentElement.getAttribute('href'), 'https://github.com/a.png');
    });

    it('does not enlarge small images', () => {
        const image = JSDOM.fragment(renderMarkdown('<img width="300" height="200" src="https://github.com/b.png">'))
            .querySelector('img');
        assert.equal(image.getAttribute('width'), '300');
        assert.equal(image.getAttribute('height'), '200');
    });

    it('opens links in a new tab', () => {
        const link = JSDOM.fragment(renderMarkdown('[AO](https://help.assistanceonline.nl)')).querySelector('a');
        assert.equal(link.getAttribute('target'), '_blank');
        assert.equal(link.getAttribute('rel'), 'noopener');
    });

    it('renders single line breaks like GitHub', () => {
        assert.match(renderMarkdown('regel 1\nregel 2'), /regel 1<br>/);
    });
});

describe('toPublicIssue', () => {
    const teamLogins = getTeamLogins([githubIssue(), githubIssue({ user: { login: 'outsider' }, milestone: null })]);
    const comments = [
        { user: { login: 'team-member' }, created_at: '2026-11-01T11:00:00Z', body: 'Update 1' },
        { user: { login: 'outsider' }, created_at: '2026-11-01T11:30:00Z', body: 'Spam' },
        { user: { login: 'team-member' }, created_at: '2026-11-01T12:00:00Z', body: 'Update 2' }
    ];

    it('only treats authors of published issues as team members', () => {
        assert.deepEqual([...teamLogins], ['team-member']);
    });

    it('shows only comments by team members as updates', () => {
        const issue = toPublicIssue(githubIssue(), comments, teamLogins, renderMarkdown);
        assert.equal(issue.updates.length, 2);
        assert.doesNotMatch(issue.updates.map(update => update.html).join(), /Spam/);
    });

    it('uses the latest update as last update time', () => {
        const issue = toPublicIssue(githubIssue(), comments, teamLogins, renderMarkdown);
        assert.equal(issue.lastUpdateAt, '2026-11-01T12:00:00Z');
    });

    it('falls back to the issue update time without comments', () => {
        const issue = toPublicIssue(githubIssue({ updated_at: '2026-11-02T08:00:00Z' }), [], teamLogins, renderMarkdown);
        assert.equal(issue.lastUpdateAt, '2026-11-02T08:00:00Z');
    });
});

describe('toIncidents', () => {
    const since = '2026-09-01T00:00:00Z';

    it('keeps incidents that overlap the period', () => {
        const incidents = toIncidents([
            githubIssue({ number: 1, closed_at: '2026-10-01T00:00:00Z' }),
            githubIssue({ number: 2, created_at: '2026-08-20T00:00:00Z', closed_at: '2026-09-02T00:00:00Z' }),
            githubIssue({ number: 3, created_at: '2026-08-01T00:00:00Z', closed_at: '2026-08-02T00:00:00Z' }),
            githubIssue({ number: 4 })
        ], since);
        assert.deepEqual(incidents.map(incident => incident.number), [1, 2, 4]);
    });

    it('ignores maintenance, announcements and unpublished issues', () => {
        const incidents = toIncidents([
            githubIssue({ number: 1, milestone: { title: 'Maintenance' } }),
            githubIssue({ number: 2, milestone: { title: 'Announcement' } }),
            githubIssue({ number: 3, milestone: null })
        ], since);
        assert.deepEqual(incidents, []);
    });
});

describe('buildFeed', () => {
    const issue = toPublicIssue(githubIssue({ number: 7, title: 'A & B <c>' }), [], new Set(), renderMarkdown);
    const feed = buildFeed({ generatedAt: '2026-11-02T00:00:00Z', openIssues: [issue], closedIssues: [] },
        'https://status.assistanceonline.nl/', 30);

    it('is valid XML with escaped titles', () => {
        const document = new JSDOM(feed, { contentType: 'application/xml' }).window.document;
        assert.equal(document.querySelector('entry > title').textContent, 'A & B <c>');
    });

    it('links entries to the issue on the status page', () => {
        assert.match(feed, /<link href="https:\/\/status\.assistanceonline\.nl\/#issue-7"\/>/);
    });
});

describe('amsterdamTimeToIso', () => {
    it('converts winter time (UTC+1)', () => {
        assert.equal(amsterdamTimeToIso(2026, 12, 3, 11, 30), '2026-12-03T10:30:00.000Z');
    });

    it('converts summer time (UTC+2)', () => {
        assert.equal(amsterdamTimeToIso(2026, 7, 1, 12, 0), '2026-07-01T10:00:00.000Z');
    });
});

describe('parseSchedule', () => {
    it('reads start and end from a comment in Dutch or ISO date format', () => {
        assert.deepEqual(parseSchedule('<!-- start: 03-12-2026 11:30, eind: 2026-12-03 12:15 -->'), {
            startAt: '2026-12-03T10:30:00.000Z',
            endAt: '2026-12-03T11:15:00.000Z'
        });
    });

    it('accepts begin as start keyword', () => {
        assert.equal(parseSchedule('<!-- begin: 23-11-2026 09:15 -->').startAt, '2026-11-23T08:15:00.000Z');
    });

    it('ignores times outside comments and unfilled placeholders', () => {
        assert.deepEqual(parseSchedule('start: 03-12-2026 11:30\n<!-- begin: DD-MM-JJJJ HH:MM -->'), { startAt: null, endAt: null });
    });
});

describe('getSchedule', () => {
    it('uses the date in a release title with a 30 minute window', () => {
        const schedule = getSchedule(githubIssue({ title: 'Release 2026.16 op 03-12-2026 om 11:30', milestone: { title: 'Announcement' } }));
        assert.deepEqual(schedule, { startAt: '2026-12-03T10:30:00.000Z', endAt: '2026-12-03T11:00:00.000Z' });
    });

    it('prefers a time in a comment over the title', () => {
        const schedule = getSchedule(githubIssue({
            title: 'Release 2026.16 op 03-12-2026 om 11:30',
            milestone: { title: 'Announcement' },
            body: '<!-- start: 03-12-2026 13:00, eind: 03-12-2026 14:00 -->'
        }));
        assert.equal(schedule.startAt, '2026-12-03T12:00:00.000Z');
        assert.equal(schedule.endAt, '2026-12-03T13:00:00.000Z');
    });

    it('does not read dates from incident titles', () => {
        assert.deepEqual(getSchedule(githubIssue({ title: 'Storing op 03-12-2026 om 11:30' })), { startAt: null, endAt: null });
    });
});

describe('analysis', () => {
    const teamLogins = new Set(['team-member']);
    const comments = [
        { user: { login: 'team-member' }, created_at: '2026-11-01T11:00:00Z', body: 'Opgelost' },
        { user: { login: 'team-member' }, created_at: '2026-11-01T12:00:00Z', body: '## Analyse\n**Oorzaak:** een volle schijf' }
    ];

    it('shows an analysis comment separately instead of as update', () => {
        const issue = toPublicIssue(githubIssue(), comments, teamLogins, renderMarkdown);
        assert.equal(issue.updates.length, 1);
        assert.match(issue.analysis, /een volle schijf/);
        assert.doesNotMatch(issue.analysis, /<h2/);
    });
});

describe('toIncidents with a start time', () => {
    it('uses the start time from the issue instead of when it was opened', () => {
        const [incident] = toIncidents([githubIssue({ body: '<!-- begin: 01-11-2026 09:00 -->' })], '2026-09-01T00:00:00Z');
        assert.equal(incident.startAt, '2026-11-01T08:00:00.000Z');
    });
});

describe('getSystemStatus', () => {
    const now = Date.parse('2026-12-03T10:45:00Z');
    const announcement = { milestone: 'Announcement', startAt: '2026-12-03T10:30:00Z', endAt: '2026-12-03T11:00:00Z' };

    it('treats an announcement within its window as maintenance', () => {
        assert.equal(getSystemStatus([announcement], now), 'maintenance');
    });

    it('ignores an announcement outside its window', () => {
        assert.equal(getSystemStatus([announcement], Date.parse('2026-12-03T11:00:00Z')), 'operational');
    });

    it('takes the most severe incident', () => {
        assert.equal(getSystemStatus([{ milestone: 'S' }, { milestone: 'XL' }], now), 'xl');
    });
});

describe('buildBadge', () => {
    it('shows the status as valid SVG', () => {
        const badge = buildBadge('xl');
        const svg = new JSDOM(badge, { contentType: 'image/svg+xml' }).window.document.documentElement;
        assert.equal(svg.getAttribute('aria-label'), 'AO status: ernstige storing');
    });
});

describe('buildCalendar', () => {
    const status = {
        generatedAt: '2026-11-26T10:00:00Z',
        openIssues: [{
            number: 385, title: 'Release 2026.16, met nieuwe functies; en meer', milestone: 'Announcement',
            startAt: '2026-12-03T10:30:00.000Z', endAt: '2026-12-03T11:00:00.000Z'
        }],
        closedIssues: [{ number: 380, title: 'Storing', milestone: 'XL', startAt: '2026-11-01T08:00:00Z', endAt: null }]
    };
    const calendar = buildCalendar(status, 'https://status.assistanceonline.nl/');
    const lines = calendar.split('\r\n');

    it('contains only scheduled releases and maintenance', () => {
        assert.equal(calendar.match(/BEGIN:VEVENT/g).length, 1);
        assert.ok(lines.includes('DTSTART:20261203T103000Z'));
        assert.ok(lines.includes('DTEND:20261203T110000Z'));
    });

    it('escapes text and folds long lines', () => {
        const unfolded = calendar.replace(/\r\n /g, '');
        assert.ok(unfolded.includes('SUMMARY:Release 2026.16\\, met nieuwe functies\\; en meer'));
        assert.ok(lines.every(line => Buffer.byteLength(line) <= 75));
    });
});
