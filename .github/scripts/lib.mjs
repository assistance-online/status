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

export function toPublicIssue(issue, comments, teamLogins, renderMarkdown) {
    const updates = comments
        .filter(comment => teamLogins.has(comment.user.login))
        .map(comment => ({ createdAt: comment.created_at, html: renderMarkdown(comment.body) }));

    return {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        lastUpdateAt: updates.at(-1)?.createdAt ?? issue.updated_at,
        milestone: issue.milestone.title,
        labels: issue.labels.map(label => label.name),
        html: renderMarkdown(issue.body),
        updates
    };
}

// Incidents overlapping the availability period, without content: the page only needs their time span.
export function toIncidents(issues, since) {
    return issues
        .filter(issue => isPublishedIssue(issue) && isIncident(issue))
        .filter(issue => !issue.closed_at || issue.closed_at >= since)
        .map(issue => ({
            number: issue.number,
            title: issue.title,
            milestone: issue.milestone.title,
            labels: issue.labels.map(label => label.name),
            createdAt: issue.created_at,
            closedAt: issue.closed_at
        }));
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
