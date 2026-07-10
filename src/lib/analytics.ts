import ReactGA from "react-ga4";

let GA_ID: string | null = null;

export function initAnalytics(trackingId: string) {
    GA_ID = trackingId;
    if (GA_ID && GA_ID !== "G-XXXXXXXXXX") {
        ReactGA.initialize(GA_ID);
    }
}

export const trackPageView = (path: string) => {
    if (GA_ID && GA_ID !== "G-XXXXXXXXXX") {
        ReactGA.send({ hitType: "pageview", page: path });
    }
};

export const trackEvent = (category: string, action: string, label?: string) => {
    if (GA_ID && GA_ID !== "G-XXXXXXXXXX") {
        ReactGA.event({
            category,
            action,
            label,
        });
    }
};
