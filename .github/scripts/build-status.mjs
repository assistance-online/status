// Generates status.json for the status page from the repository's labels and issues.
// Usage: node .github/scripts/build-status.mjs <output-file>
// Uses GITHUB_TOKEN when set; without it the unauthenticated API limit (60 requests/hour) applies.
import { writeFile } from 'node:fs/promises';

const REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'assistance-online/status';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const PAGE_SIZE = 100;
const HISTORY_SIZE = 50;

const outputFile = process.argv[2] ?? 'status.json';

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

function toPublicIssue(issue) {
    return {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        created_at: issue.created_at,
        closed_at: issue.closed_at,
        body: issue.body ?? '',
        milestone: { title: issue.milestone.title },
        labels: issue.labels.map(label => ({ name: label.name }))
    };
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

await writeFile(outputFile, JSON.stringify(status));
console.log(`Wrote ${outputFile}: ${status.labels.length} labels, ${status.openIssues.length} open, ${status.closedIssues.length} closed issues`);
