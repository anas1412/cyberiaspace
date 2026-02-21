export function hydrateProfile(profile: any) {
    const today = new Date().toISOString().split('T')[0];
    
    const defaultUsage = {
        ai_daily_count: 0,
        sync_thoughts: 0,
        last_ai_reset: today
    };

    const defaultSettings = {
        theme: 'cyberia',
        autoSync: true,
        driveEnabled: false
    };

    const hydrated = {
        ...profile,
        plan: profile.plan || 'free',
        subscriptionStatus: profile.subscriptionStatus || 'none',
        expiryDate: profile.expiryDate || null,
        usage: {
            ...defaultUsage,
            ...(profile.usage || {})
        },
        settings: {
            ...defaultSettings,
            ...(profile.settings || {})
        },
        lastSeen: new Date().toISOString()
    };

    // Special logic: Reset AI count if it's a new day
    if (hydrated.usage.last_ai_reset !== today) {
        hydrated.usage.ai_daily_count = 0;
        hydrated.usage.last_ai_reset = today;
    }

    return hydrated;
}
