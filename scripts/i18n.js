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
            'status.loading': 'Bezig met laden ...',
            'status.error': 'De status kon niet worden opgehaald. Probeer het later opnieuw.',
            'status.maintenance': 'Systeem is in onderhoud',
            'status.xl': 'Ernstige verstoring geconstateerd',
            'status.disruption': 'Storing geconstateerd',
            'status.investigation': 'Er zijn meldingen geweest over verstoringen, deze worden momenteel onderzocht.',
            'status.ok': 'Momenteel zijn er geen actuele verstoringen bekend.',
            'meta.lastUpdated': 'Laatst bijgewerkt:',
            'meta.feed': 'RSS-feed',
            'meta.filterHint': 'Klik op een onderdeel om alleen de meldingen daarvan te tonen.',
            'component.filter': 'Alleen meldingen voor dit onderdeel tonen',
            'component.clearFilter': 'Filter wissen',
            'filter.label': 'Meldingen voor',
            'filter.clear': 'Filter wissen',
            'section.planned': 'Gepland',
            'section.current': 'Actueel',
            'section.history': 'Geschiedenis',
            'section.loadMore': 'Meer laden ...',
            'empty.current': 'Er zijn geen actuele meldingen.',
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
            'issue.readMore': 'Lees meer',
            'issue.readLess': 'Minder tonen',
            'issue.permalink': 'Link naar deze melding',
            'duration.day': 'dag',
            'duration.days': 'dagen',
            'duration.hours': 'uur',
            'duration.minutes': 'min',
            'availability.title': 'Beschikbaarheid afgelopen 90 dagen',
            'availability.none': 'Geen storingen',
            'availability.countOne': '1 storing',
            'availability.countMany': '{count} storingen',
            'availability.uptime': '{percentage} beschikbaar',
            'availability.legend': 'Beschikbaarheid telt de tijd zonder storing XL of L. Storingen M en S worden wel getoond, maar tellen niet mee.',
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
            'status.loading': 'Loading ...',
            'status.error': 'The status could not be retrieved. Please try again later.',
            'status.maintenance': 'System maintenance in progress',
            'status.xl': 'Major outage detected',
            'status.disruption': 'Disruption detected',
            'status.investigation': 'Disruptions have been reported and are currently being investigated.',
            'status.ok': 'There are currently no known disruptions.',
            'meta.lastUpdated': 'Last updated:',
            'meta.feed': 'RSS feed',
            'meta.filterHint': 'Click a component to only show its reports.',
            'component.filter': 'Only show reports for this component',
            'component.clearFilter': 'Clear filter',
            'filter.label': 'Reports for',
            'filter.clear': 'Clear filter',
            'section.planned': 'Scheduled',
            'section.current': 'Current',
            'section.history': 'History',
            'section.loadMore': 'Loading more ...',
            'empty.current': 'There are no current reports.',
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
            'issue.readMore': 'Read more',
            'issue.readLess': 'Show less',
            'issue.permalink': 'Link to this report',
            'duration.day': 'day',
            'duration.days': 'days',
            'duration.hours': 'h',
            'duration.minutes': 'min',
            'availability.title': 'Availability over the past 90 days',
            'availability.none': 'No disruptions',
            'availability.countOne': '1 disruption',
            'availability.countMany': '{count} disruptions',
            'availability.uptime': '{percentage} available',
            'availability.legend': 'Availability counts the time without an XL or L disruption. M and S disruptions are shown but not counted.',
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
