// Loaded synchronously in <head> so the page never flashes in the wrong colour scheme.
// Follows the system setting until the visitor picks a theme with the toggle; that choice is remembered.
(function () {
    const STORAGE_KEY = 'ao-status-theme';
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    function readStoredTheme() {
        try {
            const theme = localStorage.getItem(STORAGE_KEY);
            return theme === 'light' || theme === 'dark' ? theme : null;
        } catch {
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Storage unavailable (private mode, blocked): the choice then only lasts for this page view.
        }
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-bs-theme');
    }

    function updateToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) {
            return;
        }
        const dark = currentTheme() === 'dark';
        const label = window.i18n.t(dark ? 'theme.toLight' : 'theme.toDark');
        toggle.querySelector('i').className = `fas ${dark ? 'fa-sun' : 'fa-moon'}`;
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        updateToggle();
    }

    let chosenTheme = readStoredTheme();
    applyTheme(chosenTheme ?? (darkScheme.matches ? 'dark' : 'light'));

    darkScheme.addEventListener('change', () => {
        if (!chosenTheme) {
            applyTheme(darkScheme.matches ? 'dark' : 'light');
        }
    });

    window.i18n.onChange(updateToggle);

    document.addEventListener('DOMContentLoaded', () => {
        updateToggle();
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            chosenTheme = currentTheme() === 'dark' ? 'light' : 'dark';
            storeTheme(chosenTheme);
            applyTheme(chosenTheme);
        });
    });
})();
