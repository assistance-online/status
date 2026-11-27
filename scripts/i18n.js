// UI texts in Dutch and English. Issue content itself is only written in Dutch.
// Loaded synchronously in <head>; static texts are marked with data-i18n (text) or data-i18n-html
// (trusted markup from this dictionary) and translated once the DOM is ready.
(function () {
    const STORAGE_KEY = 'ao-status-language';
    const DEFAULT_LANGUAGE = 'nl';

    const texts = {
        nl: {
            'nav.contact': 'Contact',
            'nav.status': 'Status',
            'nav.languageToggle': 'English',
            'theme.toDark': 'Donkere modus',
            'theme.toLight': 'Lichte modus',
            'status.error': 'De status kon niet worden opgehaald. Probeer het later opnieuw.',
            'status.maintenance': 'Systeem is in onderhoud',
            'status.xl': 'Ernstige verstoring geconstateerd',
            'status.disruption': 'Storing geconstateerd',
            'status.investigation': 'Er zijn meldingen geweest over verstoringen, deze worden momenteel onderzocht.',
            'status.ok': 'Alle systemen werken naar behoren',
            'status.loading': 'Bezig met laden ...',
            'status.affected': 'Getroffen: {components}',
            'meta.lastUpdated': 'Laatst bijgewerkt:',
            'meta.feed': 'RSS-feed',
            'meta.calendar': 'Agenda',
            'schedule.planned': 'Gepland {period}',
            'schedule.startsIn': 'begint {relative}',
            'schedule.until': 'Onderhoud tot {time}',
            'schedule.started': 'Onderhoud gestart {date}',
            'search.label': 'Zoeken in de geschiedenis',
            'search.placeholder': 'Zoek op titel, ticketnummer of tekst',
            'empty.search': 'Geen eerdere meldingen gevonden voor “{query}”.',
            'issue.started': 'Begonnen {date}',
            'issue.analysis': 'Analyse',
            'notFound.title': 'Pagina niet gevonden',
            'notFound.body': 'Deze pagina bestaat niet (meer). Bekijk de actuele status van Assistance Online op de statuspagina.',
            'notFound.link': 'Naar de statuspagina',
            'meta.filterHint': 'Klik op een onderdeel om alleen de meldingen daarvan te tonen.',
            'component.filter': 'Alleen meldingen voor dit onderdeel tonen',
            'component.clearFilter': 'Filter wissen',
            'filter.label': 'Meldingen voor',
            'filter.clear': 'Filter wissen',
            'section.planned': 'Gepland',
            'section.current': 'Actueel',
            'section.history': 'Geschiedenis',
            'section.loadMore': 'Meer laden ...',
            'empty.current': 'Geen actuele meldingen. Alles werkt naar behoren.',
            'empty.currentFiltered': 'Er zijn geen actuele meldingen voor dit onderdeel.',
            'empty.history': 'Er zijn geen eerdere meldingen.',
            'empty.historyFiltered': 'Er zijn geen eerdere meldingen voor dit onderdeel.',
            'milestone.Online': 'Online',
            'milestone.UnderInvestigation': 'Wordt onderzocht',
            'milestone.Maintenance': 'Onderhoud',
            'milestone.Announcement': 'Aankondiging',
            'milestone.Unknown': 'Onbekend',
            'issue.reported': 'Gemeld {date}',
            'issue.lastUpdate': 'Laatste update {date}',
            'issue.resolved': 'Opgelost {date}',
            'issue.completed': 'Afgerond {date}',
            'issue.duration': 'Duur {duration}',
            'issue.updates': 'Updates',
            'issue.description': 'Melding',
            'issue.permalink': 'Directe link',
            'issue.github': 'Bekijken op GitHub',
            'group.ao': 'Assistance Online',
            'group.integrations': 'Koppelingen',
            'group.other': 'Overig',
            'group.allOnline': 'Alles online ({count})',
            'group.affected': '{count} van {total} getroffen',
            'availability.start': '90 dagen geleden',
            'availability.today': 'vandaag',
            'footer.help': 'Documentatie & Support',
            'nav.backToTop': 'Terug naar boven',
            'duration.day': 'dag',
            'duration.days': 'dagen',
            'duration.hours': 'uur',
            'duration.minutes': 'min',
            'availability.none': 'Geen storingen',
            'availability.uptime': '{percentage} beschikbaar',
            'contact.title': 'Communicatie',
            'contact.questions.title': 'Vragen, kleinere incidenten en wensen',
            'contact.questions.body': 'Gebruikersvragen, kleinere incidenten en het aanmelden van wensen, ideeën en verbeterpunten kan via: <a href="mailto:ao@rgbplus.nl">ao@rgbplus.nl</a>',
            'contact.questions.docs': 'Voordat je een vraag stelt, neem eens een kijkje op <a href="https://help.assistanceonline.nl">Assistance Online Documentatie &amp; Support</a>.',
            'contact.questions.urgency': 'Optioneel: geef een urgentie mee van XS (niet urgent) tot L (urgent). Bij urgentie XL is bellen sneller.',
            'contact.questions.complete': 'Wees zo volledig mogelijk in je omschrijving van de melding. Voeg altijd een opdrachtnummer bij indien van toepassing. Screenshots helpen ook.',
            'contact.urgent.title': 'Urgente meldingen overdag',
            'contact.urgent.body': 'Bel <a href="tel:+31572745247">+31 (0) 572 - 745247</a>. Urgente meldingen zijn verstoringen in het proces die niet nog één of meerdere dagen kunnen wachten. Het betreft hier dus geen ontbrekende functionaliteiten (zie bovenstaand). Deze meldingen zullen doorgaans binnen de lopende sprint worden opgepakt.',
            'contact.afterHours.title': 'Urgente meldingen buiten kantoortijd',
            'contact.afterHours.body': 'Via het noodnummer van AO, dat uitgeleverd is aan klanten met de Plus-SLA. Dit is alleen bij <i>standstill</i> zaken.'
        },
        en: {
            'nav.contact': 'Contact',
            'nav.status': 'Status',
            'nav.languageToggle': 'Nederlands',
            'theme.toDark': 'Dark mode',
            'theme.toLight': 'Light mode',
            'status.error': 'The status could not be retrieved. Please try again later.',
            'status.maintenance': 'System maintenance in progress',
            'status.xl': 'Major outage detected',
            'status.disruption': 'Disruption detected',
            'status.investigation': 'Disruptions have been reported and are currently being investigated.',
            'status.ok': 'All systems operational',
            'status.loading': 'Loading ...',
            'status.affected': 'Affected: {components}',
            'meta.lastUpdated': 'Last updated:',
            'meta.feed': 'RSS feed',
            'meta.calendar': 'Calendar',
            'schedule.planned': 'Scheduled {period}',
            'schedule.startsIn': 'starts {relative}',
            'schedule.until': 'Maintenance until {time}',
            'schedule.started': 'Maintenance started {date}',
            'search.label': 'Search the history',
            'search.placeholder': 'Search by title, ticket number or text',
            'empty.search': 'No earlier reports found for “{query}”.',
            'issue.started': 'Started {date}',
            'issue.analysis': 'Analysis',
            'notFound.title': 'Page not found',
            'notFound.body': 'This page does not exist (anymore). See the current status of Assistance Online on the status page.',
            'notFound.link': 'Go to the status page',
            'meta.filterHint': 'Click a component to only show its reports.',
            'component.filter': 'Only show reports for this component',
            'component.clearFilter': 'Clear filter',
            'filter.label': 'Reports for',
            'filter.clear': 'Clear filter',
            'section.planned': 'Scheduled',
            'section.current': 'Current',
            'section.history': 'History',
            'section.loadMore': 'Loading more ...',
            'empty.current': 'No current reports. Everything is working normally.',
            'empty.currentFiltered': 'There are no current reports for this component.',
            'empty.history': 'There are no earlier reports.',
            'empty.historyFiltered': 'There are no earlier reports for this component.',
            'milestone.Online': 'Online',
            'milestone.UnderInvestigation': 'Investigating',
            'milestone.Maintenance': 'Maintenance',
            'milestone.Announcement': 'Announcement',
            'milestone.Unknown': 'Unknown',
            'issue.reported': 'Reported {date}',
            'issue.lastUpdate': 'Last update {date}',
            'issue.resolved': 'Resolved {date}',
            'issue.completed': 'Completed {date}',
            'issue.duration': 'Duration {duration}',
            'issue.updates': 'Updates',
            'issue.description': 'Report',
            'issue.permalink': 'Direct link',
            'issue.github': 'View on GitHub',
            'group.ao': 'Assistance Online',
            'group.integrations': 'Integrations',
            'group.other': 'Other',
            'group.allOnline': 'All online ({count})',
            'group.affected': '{count} of {total} affected',
            'availability.start': '90 days ago',
            'availability.today': 'today',
            'footer.help': 'Documentation & Support',
            'nav.backToTop': 'Back to top',
            'duration.day': 'day',
            'duration.days': 'days',
            'duration.hours': 'h',
            'duration.minutes': 'min',
            'availability.none': 'No disruptions',
            'availability.uptime': '{percentage} available',
            'contact.title': 'Communication',
            'contact.questions.title': 'Questions, minor incidents and requests',
            'contact.questions.body': 'User questions, minor incidents and feature requests, ideas and suggestions can be sent to: <a href="mailto:ao@rgbplus.nl">ao@rgbplus.nl</a>',
            'contact.questions.docs': 'Before asking a question, have a look at <a href="https://help.assistanceonline.nl">Assistance Online Documentation &amp; Support</a>.',
            'contact.questions.urgency': 'Optional: state an urgency from XS (not urgent) to L (urgent). For urgency XL, calling is faster.',
            'contact.questions.complete': 'Describe the issue as completely as possible. Always include an order number where applicable. Screenshots help too.',
            'contact.urgent.title': 'Urgent reports during office hours',
            'contact.urgent.body': 'Call <a href="tel:+31572745247">+31 (0) 572 - 745247</a>. Urgent reports are disruptions of the process that cannot wait one or more days. This does not cover missing functionality (see above). These reports are usually handled within the current sprint.',
            'contact.afterHours.title': 'Urgent reports outside office hours',
            'contact.afterHours.body': 'Via the AO emergency number, provided to customers with the Plus SLA. Only for <i>standstill</i> situations.'
        }
    };

    const listeners = [];

    function readStoredLanguage() {
        try {
            const language = localStorage.getItem(STORAGE_KEY);
            return language in texts ? language : null;
        } catch {
            return null;
        }
    }

    function storeLanguage(language) {
        try {
            localStorage.setItem(STORAGE_KEY, language);
        } catch {
            // Storage unavailable (private mode, blocked): the choice then only lasts for this page view.
        }
    }

    let language = readStoredLanguage() ?? DEFAULT_LANGUAGE;

    function t(key, params = {}) {
        const text = texts[language][key] ?? texts[DEFAULT_LANGUAGE][key] ?? key;
        return text.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    }

    function translatePage() {
        document.documentElement.lang = language;
        document.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = t(element.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            element.placeholder = t(element.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
        });
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            element.innerHTML = t(element.dataset.i18nHtml);
        });
        const toggle = document.getElementById('language-toggle');
        if (toggle) {
            const other = language === 'nl' ? 'en' : 'nl';
            toggle.textContent = other.toUpperCase();
            toggle.setAttribute('aria-label', t('nav.languageToggle'));
            toggle.title = t('nav.languageToggle');
            toggle.lang = other;
        }
    }

    function setLanguage(newLanguage) {
        language = newLanguage;
        storeLanguage(language);
        translatePage();
        listeners.forEach(listener => listener(language));
    }

    window.i18n = {
        t,
        get language() {
            return language;
        },
        get locale() {
            return language === 'nl' ? 'nl-NL' : 'en-GB';
        },
        onChange(listener) {
            listeners.push(listener);
        }
    };

    document.documentElement.lang = language;
    document.addEventListener('DOMContentLoaded', () => {
        translatePage();
        document.getElementById('language-toggle')?.addEventListener('click', () => {
            setLanguage(language === 'nl' ? 'en' : 'nl');
        });
    });
})();
