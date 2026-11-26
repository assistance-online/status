// Generates status.json and feed.xml for the status page from the repository's labels and issues.
// Usage: node .github/scripts/build-status.mjs <output-directory>
// Uses GITHUB_TOKEN when set; without it the unauthenticated API limit (60 requests/hour) applies.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

const REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'assistance-online/status';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const SITE_URL = 'https://status.assistanceonline.nl/';
const PAGE_SIZE = 100;
const HISTORY_SIZE = 50;
const FEED_SIZE = 30;
const MAX_IMAGE_HEIGHT = 400;

const outputDirectory = process.argv[2] ?? '.';

const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

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

// Anyone can open an issue on the public repository, but only collaborators can set a milestone,
// so issues without a milestone are never published.
function isPublishedIssue(issue) {
    return !issue.pull_request && !!issue.milestone;
}

// GitHub stores pasted screenshots as <img width height> at their full size; scale them down to fit
// MAX_IMAGE_HEIGHT while keeping the aspect ratio, and link to the full-size image.
function fitImages(container) {
    container.querySelectorAll('img').forEach(image => {
        const width = Number(image.getAttribute('width'));
        const height = Number(image.getAttribute('height'));
        image.removeAttribute('width');
        image.removeAttribute('height');
        image.setAttribute('loading', 'lazy');
        image.setAttribute('class', 'issue-image');

        if (width > 0 && height > 0) {
            const displayWidth = Math.round(Math.min(width, MAX_IMAGE_HEIGHT * width / height));
            image.setAttribute('style', `width: ${displayWidth}px; aspect-ratio: ${width} / ${height}`);
        }

        if (!image.closest('a')) {
            const link = container.ownerDocument.createElement('a');
            link.setAttribute('href', image.getAttribute('src'));
            image.replaceWith(link);
            link.append(image);
        }
    });
}

function renderBody(markdown) {
    const container = window.document.createElement('div');
    container.innerHTML = DOMPurify.sanitize(marked.parse(markdown ?? '', { gfm: true, breaks: true }));
    fitImages(container);
    container.querySelectorAll('a[href]').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
    });
    return container.innerHTML;
}

function toPublicIssue(issue) {
    return {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        milestone: issue.milestone.title,
        labels: issue.labels.map(label => label.name),
        html: renderBody(issue.body)
    };
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function buildFeed(status) {
    const issues = [...status.openIssues, ...status.closedIssues]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, FEED_SIZE);

    const entries = issues.map(issue => `
  <entry>
    <id>${escapeXml(issue.url)}</id>
    <title>${escapeXml(`${issue.closedAt ? '[Opgelost] ' : ''}${issue.title}`)}</title>
    <link href="${escapeXml(issue.url)}"/>
    <published>${issue.createdAt}</published>
    <updated>${issue.updatedAt}</updated>
    ${issue.labels.map(label => `<category term="${escapeXml(label)}"/>`).join('')}
    <content type="html">${escapeXml(issue.html)}</content>
  </entry>`).join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="nl">
  <id>${SITE_URL}</id>
  <title>Assistance Online - Status</title>
  <link href="${SITE_URL}"/>
  <link rel="self" href="${SITE_URL}feed.xml"/>
  <updated>${status.generatedAt}</updated>
  <author><name>Assistance Online</name></author>${entries}
</feed>
`;
}

const [labels, openIssues, closedIssues] = await Promise.all([
    getAllPages('labels?'),
    getAllPages('issues?state=open'),
    get(`issues?state=closed&per_page=${PAGE_SIZE}`)
]);

const status = {
    generatedAt: new Date().toISOString(),
    labels: labels.map(label => label.name),
    openIssues: openIssues.filter(isPublishedIssue).map(toPublicIssue),
    closedIssues: closedIssues.filter(isPublishedIssue).slice(0, HISTORY_SIZE).map(toPublicIssue)
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, 'status.json'), JSON.stringify(status));
await writeFile(join(outputDirectory, 'feed.xml'), buildFeed(status));
console.log(`Wrote status.json and feed.xml to ${outputDirectory}: ${status.labels.length} labels, `
    + `${status.openIssues.length} open, ${status.closedIssues.length} closed issues`);
