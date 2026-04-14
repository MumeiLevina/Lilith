const DEFAULT_WEB_PORT = 3000;
const DASHBOARD_PATH = '/dashboard';

function buildDashboardUrl(guildId) {
    const configuredBase =
        process.env.WEB_DASHBOARD_URL
        || process.env.PUBLIC_DASHBOARD_URL
        || process.env.WEB_ORIGIN
        || `http://localhost:${Number(process.env.WEB_PORT) || DEFAULT_WEB_PORT}`;

    if (!configuredBase || typeof configuredBase !== 'string') {
        return null;
    }

    try {
        const base = configuredBase.trim();
        const normalizedBase = /\/dashboard\/?$/i.test(base)
            ? base
            : `${base.replace(/\/+$/, '')}${DASHBOARD_PATH}`;
        const dashboardUrl = new URL(normalizedBase);

        if (guildId && typeof guildId === 'string') {
            dashboardUrl.searchParams.set('guildId', guildId.trim());
        }

        return dashboardUrl.toString();
    } catch {
        return null;
    }
}

module.exports = {
    buildDashboardUrl
};
