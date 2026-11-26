// Runs the real index.html with i18n.js, theme.js and main.js in jsdom against a fixed status.json.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html').replace(/<script[^>]*><\/script>/g, '');
const scripts = ['scripts/i18n.js', 'scripts/theme.js', 'scripts/main.js'].map(read);

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const isoDaysAgo = days => new Date(now - days * DAY_MS).toISOString();

function issue(number, overrides = {}) {
    return {
        number,
        title: `Melding ${number}`,
        url: `https://github.com/assistance-online/status/issues/${number}`,
        createdAt: isoDaysAgo(number),
        updatedAt: isoDaysAgo(number),
        closedAt: isoDaysAgo(number - 0.5),
        lastUpdateAt: isoDaysAgo(number),
        milestone: 'S',
        labels: ['AO api'],
        html: `<p>Tekst ${number}</p>`,
        updates: [],
        ...overrides
    };
}

function createStatus() {
    return {
        generatedAt: new Date(now).toISOString(),
        labels: ['AO api', 'Integratie SOS'],
        openIssues: [
            issue(1000, { createdAt: isoDaysAgo(0.2), closedAt: null, milestone: 'XL', title: '<b>API</b> plat',
                lastUpdateAt: isoDaysAgo(0.1), updates: [{ createdAt: isoDaysAgo(0.1), html: '<p>Oorzaak gevonden</p>' }] }),
            issue(1001, { createdAt: isoDaysAgo(1), closedAt: null, milestone: 'Announcement', labels: ['Integratie SOS'] })
        ],
        closedIssues: Array.from({ length: 25 }, (_, index) => issue(index + 2)),
        availability: {
            since: isoDaysAgo(90),
            incidents: [{ number: 5, title: 'API plat', milestone: 'XL', labels: ['AO api'],
                startAt: isoDaysAgo(10), endAt: isoDaysAgo(9) }]
        }
    };
}

let dom;
let observers;
let fetchCount;

async function load({ hash = '', status = createStatus(), language } = {}) {
    dom = new JSDOM(html, { url: `https://status.assistanceonline.nl/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
    const window = dom.window;
    observers = [];
    fetchCount = 0;
    window.IntersectionObserver = class {
        constructor(callback) {
            this.callback = callback;
            this.targets = new Set();
            observers.push(this);
        }
        observe(target) { this.targets.add(target); }
        unobserve(target) { this.targets.delete(target); }
    };
    window.matchMedia = () => ({ matches: false, addEventListener() {} });
    window.setInterval = () => 0;
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.fetch = async url => {
        if (url === 'images/favicon.svg') {
            return { ok: true, text: async () => read('images/favicon.svg') };
        }
        fetchCount++;
        return { ok: true, json: async () => structuredClone(status) };
    };
    if (language) {
        window.localStorage.setItem('ao-status-language', language);
    }

    scripts.forEach(script => window.eval(script));
    await new Promise(resolve => setTimeout(resolve, 20));
    return window.document;
}

function scrollToHistoryEnd(document) {
    const sentinel = document.getElementById('history-sentinel');
    const observer = observers.find(o => o.targets.has(sentinel));
    observer?.callback([{ isIntersecting: true, target: sentinel }]);
}

const text = (document, selector) => document.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim();

describe('status page', () => {
    beforeEach(() => {
        dom = null;
    });

    afterEach(() => dom?.window.close());

    it('shows the most severe current incident as overall status', async () => {
        const document = await load();
        assert.match(document.getElementById('system-status').className, /status-xl/);
        assert.equal(text(document, '#system-status .card-title'), 'Ernstige verstoring geconstateerd');
        const favicon = decodeURIComponent(document.getElementById('favicon').href);
        assert.match(favicon, /^data:image\/svg\+xml,<svg/);
        assert.match(favicon, /<circle cx="154" cy="77" r="25" fill="#d51c00"/);
    });

    it('lists announcements under planned without affecting component status', async () => {
        const document = await load();
        assert.equal(document.getElementById('planned-section').hidden, false);
        assert.equal(text(document, '#planned-count'), '1');
        assert.equal(text(document, '[data-component="Integratie SOS"] .status-text'), 'Online');
        assert.equal(text(document, '[data-component="AO api"] .status-text'), 'XL');
    });

    it('escapes issue titles', async () => {
        const document = await load();
        assert.equal(document.querySelector('#current-issues .issue-title b'), null);
        assert.match(text(document, '#current-issues .issue-title'), /<b>API<\/b> plat/);
    });

    it('shows updates newest first and the last update time of open issues', async () => {
        const document = await load();
        assert.equal(text(document, '#issue-1000 .issue-update div'), 'Oorzaak gevonden');
        assert.match(text(document, '#issue-1000 .issue-dates'), /Laatste update/);
    });

    it('renders the history in batches with month headers', async () => {
        const document = await load();
        assert.equal(document.querySelectorAll('#history-issues .issue').length, 10);
        assert.ok(document.querySelectorAll('#history-issues .history-month').length >= 1);

        scrollToHistoryEnd(document);
        scrollToHistoryEnd(document);
        assert.equal(document.querySelectorAll('#history-issues .issue').length, 25);
        assert.equal(document.getElementById('history-sentinel').hidden, true);
    });

    it('shows resolved time and duration for incidents in the history', async () => {
        const document = await load();
        assert.match(text(document, '#issue-2 .issue-dates'), /Opgelost .* · Duur 12 uur/);
    });

    it('filters on a component from the link and clears the filter', async () => {
        const document = await load({ hash: '#onderdeel=Integratie%20SOS' });
        assert.equal(document.getElementById('filter-info').hidden, false);
        assert.equal(text(document, '#current-count'), '0');
        assert.equal(document.querySelectorAll('#history-issues .issue').length, 0);

        document.getElementById('filter-clear').click();
        assert.equal(document.getElementById('filter-info').hidden, true);
        assert.equal(text(document, '#current-count'), '1');
    });

    it('opens a direct link to an issue deep in the history', async () => {
        const document = await load({ hash: '#issue-24' });
        const card = document.getElementById('issue-24');
        assert.ok(card);
        assert.match(card.className, /is-highlighted/);
    });

    it('computes availability per component over 90 days', async () => {
        const document = await load();
        const rows = [...document.querySelectorAll('.availability-row')];
        assert.equal(rows.length, 2);
        assert.equal(rows[0].querySelectorAll('.availability-bar').length, 90);
        assert.ok(rows[0].querySelector('.availability-bar.status-xl'));
        assert.match(text(rows[0], '.availability-uptime'), /98,8\d% beschikbaar/);
        assert.match(text(rows[1], '.availability-uptime'), /100% beschikbaar/);
    });

    it('switches static and dynamic texts to English', async () => {
        const document = await load();
        document.getElementById('language-toggle').click();
        assert.equal(document.documentElement.lang, 'en');
        assert.equal(text(document, '[data-i18n="section.history"]'), 'History');
        assert.equal(text(document, '#system-status .card-title'), 'Major outage detected');
        assert.equal(text(document, '#language-toggle'), 'NL');
        assert.equal(dom.window.localStorage.getItem('ao-status-language'), 'en');
    });

    it('remembers the chosen language', async () => {
        const document = await load({ language: 'en' });
        assert.equal(text(document, '[data-i18n="section.current"]'), 'Current');
        assert.match(text(document, '#issue-2 .issue-dates'), /Resolved/);
    });

    it('does not re-render when an auto-refresh returns the same data', async () => {
        const document = await load();
        const firstCard = document.querySelector('#history-issues .issue');
        await dom.window.eval('loadStatus()');
        assert.equal(fetchCount, 2);
        assert.equal(document.querySelector('#history-issues .issue'), firstCard);
    });
});

describe('status page scheduling, analysis and search', () => {
    afterEach(() => dom?.window.close());

    function statusWith(changes) {
        const status = createStatus();
        changes(status);
        return status;
    }

    it('warns when the data has not been updated for hours', async () => {
        const document = await load({ status: statusWith(status => { status.generatedAt = isoDaysAgo(0.5); }) });
        assert.equal(document.getElementById('stale-warning').hidden, false);
        assert.match(text(document, '#stale-warning'), /mogelijk verouderd/);
    });

    it('does not warn for recent data', async () => {
        const document = await load();
        assert.equal(document.getElementById('stale-warning').hidden, true);
    });

    it('shows the planned time and a countdown for an upcoming release', async () => {
        const document = await load({ status: statusWith(status => {
            Object.assign(status.openIssues[1], { startAt: isoDaysAgo(-3), endAt: isoDaysAgo(-3.02) });
        }) });
        assert.match(text(document, '#issue-1001 .issue-dates'), /^Gepland .* · begint over 3 dagen$/);
    });

    it('treats a release as maintenance during its scheduled window', async () => {
        const document = await load({ status: statusWith(status => {
            status.openIssues.splice(0, 1);
            Object.assign(status.openIssues[0], { startAt: isoDaysAgo(0.01), endAt: isoDaysAgo(-0.01) });
        }) });
        assert.equal(text(document, '#system-status .card-title'), 'Systeem is in onderhoud');
        assert.equal(document.getElementById('planned-section').hidden, true);
        assert.ok(document.querySelector('#current-issues #issue-1001'));
        assert.match(text(document, '#issue-1001 .issue-dates'), /^Onderhoud tot /);
        assert.equal(text(document, '[data-component="Integratie SOS"] .status-text'), 'Onderhoud');
    });

    it('shows an analysis above the updates', async () => {
        const document = await load({ status: statusWith(status => {
            status.closedIssues[0].analysis = '<p><strong>Oorzaak:</strong> volle schijf</p>';
        }) });
        const body = document.querySelector('#issue-2 .issue-body');
        assert.equal(body.firstElementChild.className, 'issue-analysis');
        assert.match(text(body, '.issue-analysis'), /Analyses*Oorzaak: volle schijf/);
    });

    it('uses a start time from the issue for the duration', async () => {
        const document = await load({ status: statusWith(status => {
            status.closedIssues[0].startAt = isoDaysAgo(3);
        }) });
        assert.match(text(document, '#issue-2 .issue-dates'), /^Begonnen .* · Gemeld .* · Opgelost .* · Duur 1 dag 12 uur$/);
    });

    it('searches the history', async () => {
        const document = await load({ status: statusWith(status => {
            status.closedIssues[5].title = 'AO-12308 PDF-weergave per template';
        }) });
        const input = document.getElementById('history-search');
        input.value = 'ao-12308';
        input.dispatchEvent(new dom.window.Event('input'));
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.equal(document.querySelectorAll('#history-issues .issue').length, 1);

        input.value = 'bestaat niet';
        input.dispatchEvent(new dom.window.Event('input'));
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.match(text(document, '#history-issues .empty-text'), /Geen eerdere meldingen gevonden voor “bestaat niet”/);
    });
});

describe('favicon', () => {
    afterEach(() => dom?.window.close());

    it('shows the plain AO plus when there are no disruptions', async () => {
        const status = createStatus();
        status.openIssues = [];
        const document = await load({ status });
        assert.match(document.getElementById('favicon').href, /images\/favicon\.svg$/);
    });
});
