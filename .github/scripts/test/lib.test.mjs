import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildFeed, createRenderer, getTeamLogins, isPublishedIssue, toIncidents, toPublicIssue } from '../lib.mjs';

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
