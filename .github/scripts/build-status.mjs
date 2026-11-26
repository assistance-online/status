// Generates status.json, feed.xml, agenda.ics and badge.svg for the status page from the repository's labels and issues.
// Usage: node .github/scripts/build-status.mjs <output-directory>
// Uses GITHUB_TOKEN when set; without it the unauthenticated API limit (60 requests/hour) applies.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
    buildBadge, buildCalendar, buildFeed, createRenderer, getSystemStatus, getTeamLogins, isPublishedIssue, toIncidents, toPublicIssue
} from './lib.mjs';

const REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'assistance-online/status';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const SITE_URL = 'https://status.assistanceonline.nl/';
const PAGE_SIZE = 100;
const HISTORY_SIZE = 50;
const FEED_SIZE = 30;
const AVAILABILITY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const outputDirectory = process.argv[2] ?? '.';

async function get(path) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`${API}/${path}`, { headers });
    if (!response.ok) {
        throw new Error(`GET ${path} returned ${response.status}: ${await response.text()}`);
    }
    return response.json();
}

async function getAllPages(path) {
    const results = [];
    for (let page = 1; ; page++) {
        const items = await get(`${path}&per_page=${PAGE_SIZE}&page=${page}`);
        results.push(...items);
        if (items.length < PAGE_SIZE) {
            return results;
        }
    }
}

// Closed issues, newest first, until there are enough for the history and they reach back past the
// availability period (with a margin for incidents that were open for a while).
async function getClosedIssues(availabilitySince) {
    const fetchUntil = new Date(Date.parse(availabilitySince) - 30 * DAY_MS).toISOString();
    const results = [];
    for (let page = 1; ; page++) {
        const items = await get(`issues?state=closed&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`);
        results.push(...items);
        const published = results.filter(isPublishedIssue);
        const oldest = items.at(-1)?.created_at;
        if (items.length < PAGE_SIZE || (published.length >= HISTORY_SIZE && oldest < fetchUntil)) {
            return results;
        }
    }
}

async function getComments(issue) {
    return issue.comments > 0 ? getAllPages(`issues/${issue.number}/comments?`) : [];
}

const now = new Date();
const availabilitySince = new Date(now.getTime() - AVAILABILITY_DAYS * DAY_MS).toISOString();

const [labels, openIssues, closedIssues] = await Promise.all([
    getAllPages('labels?'),
    getAllPages('issues?state=open'),
    getClosedIssues(availabilitySince)
]);

const teamLogins = getTeamLogins([...openIssues, ...closedIssues]);
const renderMarkdown = createRenderer(new JSDOM('').window);

async function publish(issues) {
    return Promise.all(issues.map(async issue =>
        toPublicIssue(issue, await getComments(issue), teamLogins, renderMarkdown)));
}

const status = {
    generatedAt: now.toISOString(),
    labels: labels.map(label => label.name),
    openIssues: await publish(openIssues.filter(isPublishedIssue)),
    closedIssues: await publish(closedIssues.filter(isPublishedIssue).slice(0, HISTORY_SIZE)),
    availability: {
        since: availabilitySince,
        incidents: toIncidents([...openIssues, ...closedIssues], availabilitySince)
    }
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, 'status.json'), JSON.stringify(status));
await writeFile(join(outputDirectory, 'feed.xml'), buildFeed(status, SITE_URL, FEED_SIZE));
await writeFile(join(outputDirectory, 'agenda.ics'), buildCalendar(status, SITE_URL));
await writeFile(join(outputDirectory, 'badge.svg'), buildBadge(getSystemStatus(status.openIssues, now.getTime())));
console.log(`Wrote status.json, feed.xml, agenda.ics and badge.svg to ${outputDirectory}: ${status.labels.length} labels, `
    + `${status.openIssues.length} open, ${status.closedIssues.length} closed issues, `
    + `${status.availability.incidents.length} incidents since ${availabilitySince.slice(0, 10)}`);
