interface AssetSources {
    logoBig: any;
    logoQ: any;
}

let sources: AssetSources = {
    logoBig: null,
    logoQ: null,
};

export function registerAssets(s: Partial<AssetSources>) {
    sources = { ...sources, ...s };
}

export const Assets = {
    get logoBig() { return sources.logoBig; },
    get logoQ() { return sources.logoQ; },
};
