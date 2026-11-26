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
                createdAt: isoDaysAgo(10), closedAt: isoDaysAgo(9) }]
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
    window.fetch = async () => {
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
        assert.match(document.getElementById('favicon').href, /^data:image\/svg\+xml/);
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
