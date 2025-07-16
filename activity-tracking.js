// === CONFIGURATION ===
const defaultConfig = {
  userIdExpirationTime: 13 * 30 * 24 * 60 * 60 * 1000, // 13 months
  visitIdExpirationTime: 30 * 60 * 1000, // 30 minutes
  exclusionList: ["paypal.com", "3dsecure", "wlp-acs", "-3ds-", ".3ds.", "visa.com"],
  cookieName: "uv_ids",
  visitEngagementDelay: 10000, // 10 seconds
  sourceParams: ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"]
};

window.initActivityTracking = (userConfig = {}) => {
  const config = { ...defaultConfig, ...userConfig };

  // === UTILS ===
  const generateUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

  const isExpired = (item, duration) =>
    !item || item.expirationDate < Date.now();

  const setCookie = (name, value, expiresTimestamp) => {
    const expires = expiresTimestamp
      ? `; expires=${new Date(expiresTimestamp).toUTCString()}`
      : "";
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
  };

  const getFromStorage = key => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };

  const setInStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const isInternalReferrer = referrer => {
    try {
      return new URL(referrer).hostname === window.location.hostname;
    } catch {
      return true;
    }
  };

  const isExcludedReferrer = referrer => {
    try {
      const host = new URL(referrer).hostname;
      return config.exclusionList.some(ex => host.includes(ex));
    } catch {
      return false;
    }
  };

  const sourcesAreDifferent = (a = {}, b = {}) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return Array.from(keys).some(key => a[key] !== b[key]);
  };

  const isValidNewSource = source => {
    if (!source) return false;
    const hasRecognizedParam = config.sourceParams.some(key => !!source[key]);
    return hasRecognizedParam || !!source.referrer;
  };

  const buildSource = () => {
    const source = {};
    const ref = document.referrer;
    if (!isInternalReferrer(ref) && !isExcludedReferrer(ref)) {
      source.referrer = ref;
    }
    const params = new URLSearchParams(window.location.search);
    config.sourceParams.forEach(key => {
      const val = params.get(key);
      if (val) source[key] = val;
    });
    return source;
  };

  const detectDeviceType = () => {
    const ua = navigator.userAgent;
    const isTablet = /Tablet|iPad|Nexus 7|Nexus 10|SM-T|GT-P|Kindle|Silk/i.test(ua);
    const isMobile = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && !isTablet;
    return isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  };

  // === MAIN ===
  window.dataLayer = window.dataLayer || [];
  const now = Date.now();
  const landingPage = window.location.href;
  const currentSource = buildSource();
  const deviceType = detectDeviceType();
  let currentUserId = getFromStorage("userActivity");

  let isNewUser = false, isNewVisit = false, isNewSource = false;
  const previousSource = currentUserId?.visit?.source
    ? JSON.parse(JSON.stringify(currentUserId.visit.source))
    : null;

  if (isExpired(currentUserId, config.userIdExpirationTime)) {
    isNewUser = isNewVisit = true;
    currentUserId = {
      id: generateUUID(),
      expirationDate: now + config.userIdExpirationTime,
      lastActivity: now,
      landingPage,
      source: currentSource,
      visit: {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage,
        source: currentSource,
        count: 1,
        isEngaged: false
      }
    };
  } else {
    if (isExpired(currentUserId.visit, config.visitIdExpirationTime)) {
      isNewVisit = true;
      currentUserId.visit = {
        id: generateUUID(),
        expirationDate: now + config.visitIdExpirationTime,
        landingPage,
        source: currentSource,
        count: (currentUserId.visit?.count || 0) + 1,
        isEngaged: false
      };
    } else {
      if (isValidNewSource(currentSource) && sourcesAreDifferent(previousSource, currentSource)) {
        isNewSource = true;
        currentUserId.visit.source = currentSource;
      }
      currentUserId.lastActivity = now;
      currentUserId.visit.expirationDate = now + config.visitIdExpirationTime;
    }
  }

  setInStorage("userActivity", currentUserId);
  setCookie(config.cookieName, JSON.stringify({
    userId: currentUserId.id,
    visitId: currentUserId.visit.id
  }), currentUserId.expirationDate);

  // === DATALAYER EVENTS ===
  window.dataLayer.push({
    event: "page_load",
    userActivity: JSON.parse(JSON.stringify(currentUserId)),
    deviceType
  });

  if (isNewUser) window.dataLayer.push({ event: "first_visit" });
  if (isNewVisit) {
    window.dataLayer.push({ event: "visit_start" });

    setTimeout(() => {
      const updated = getFromStorage("userActivity");
      if (updated?.visit?.id === currentUserId.visit.id) {
        updated.visit.isEngaged = true;
        setInStorage("userActivity", updated);
        window.dataLayer.push({
          event: "visit_engaged",
          visit: { isEngaged: true }
        });
      }
    }, config.visitEngagementDelay);
  }

  if (isNewSource && !isNewVisit) {
    window.dataLayer.push({ event: "new_visit_source" });
  }
};