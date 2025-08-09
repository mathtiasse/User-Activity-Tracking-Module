# 📊 Activity Tracking Module

A lightweight JavaScript module for tracking user and session activity in client-side applications, with support for:

- Unique user & session identifiers (stored in both `localStorage` and cookies)
- Session timeout and engagement measurement
- UTM and referrer-based source tracking
- SPA navigation tracking (optional)
- Scroll depth tracking with configurable thresholds
- Core Web Vitals tracking (LCP, INP, CLS)
- Error tracking (window.onerror, unhandledrejection)
- Adblock detection (`is_adblock` in `visit_start` event)
- Custom metadata (`customData`) support
- Modular event connectors (e.g., GTM, GA)
- Device type detection
- Custom events via `window.ActivityTracking.sendEvent()`

---

## 🚀 Installation

Include the script and initialize:

```html
<script src="/path/to/activity-tracking.js"></script>
<script>
    ActivityTracking.init({
    autoTagging: true,
    connectors: ["gtm"],
    sourceParams: ["utm_source", "utm_medium", "utm_campaign", "gclid"],
    exclusionList: ["paypal.com", "3dsecure"]
  });
</script>
```

Or with configuration:

```js
initActivityTracking({
  visitEngagementDelay: 15000,
  sourceParams: ["utm_source", "utm_medium", "gclid"],
  exclusionList: ["paypal.com", "3dsecure"],
  trackSpaPages: true,
  autoTagging: true,
  connectors: ["gtm"],
  trackWebVitals: true,
  enableErrorTracking: true,
  detectAdblock: true,
  scrollTrackingThresholds: [10, 25, 50, 75, 100]
});
```

---

## ⚙️ Configuration Options

| Option                    | Type         | Default                                           | Description |
|---------------------------|--------------|---------------------------------------------------|-------------|
| `userIdExpirationTime`    | number       | `13 * 30 * 24 * 60 * 60 * 1000` (13 months)       | Lifetime of the user ID |
| `visitIdExpirationTime`   | number       | `30 * 60 * 1000` (30 min)                         | Session timeout duration |
| `visitEngagementDelay`    | number       | `10000` (10 sec)                                  | Delay to consider the visit as engaged |
| `exclusionList`           | string[]     | `["paypal.com", "3dsecure", "..."]`              | Referrers to exclude |
| `sourceParams`            | string[]     | `["utm_source", "utm_medium", "utm_campaign", ...]` | URL params to detect as traffic sources |
| `cookieName`              | string       | `"uv_ids"`                                        | Cookie name storing user/visit IDs |
| `trackSpaPages`           | boolean      | `true`                                            | Enable tracking page changes in SPAs |
| `autoTagging`             | boolean      | `true`                                            | Automatically send `page_load`, `visit_start`, etc. |
| `trackWebVitals`          | boolean      | `true`                                            | Enable Core Web Vitals tracking |
| `enableErrorTracking`     | boolean      | `true`                                            | Capture JS errors and promise rejections |
| `detectAdblock`           | boolean      | `true`                                            | Adds `is_adblock` to `visit_start` event |
| `scrollTrackingThresholds`| number[]     | `[10, 25, 50, 75, 100]`                           | Scroll % thresholds to trigger scroll events |
| `connectors`              | string[]     | `["gtm"]`                                         | List of event connector modules to use |

---

## 🧠 Tracked Events

### `page_load`
```js
{
  event: "page_load",
  userActivity: { ... },
  deviceType: "desktop" | "mobile" | "tablet"
}
```

### `first_visit`, `visit_start`, `visit_engaged`, `new_visit_source`
Automatically dispatched based on session state.

### `scroll_depth`
Triggered on each scroll threshold reached.

```js
{
  event: "scroll_depth",
  threshold: 25,
  userActivity: { ... }
}
```

### `web_vitals_summary`
Dispatched 10s after a page loaded or on unload.

```js
{
  event: "web_vitals_summary",
  web_vitals: {
    LCP: { value: 1320, rating: "good" },
    CLS: { value: 0.04, rating: "good" },
    INP: { value: 98, rating: "good" }
  }
}
```

### `js_error`
Triggered on uncaught JS error or unhandled promise rejection.

```js
{
  event: "js_error",
  message: "Unexpected token",
  source: "main.js",
  lineno: 42,
  colno: 12
}
```

---

## 📦 Data Storage

- **localStorage**: stores full user object under key `userActivity`
- **Cookies**: stores `{ userId, visitId }` under the configured `cookieName`

---

## 📐 Public API

Accessible via `window.ActivityTracking`:

### 📥 Data Access
- `getUserId()`
- `getVisitId()`
- `getAllData()`

### 🧩 Custom Data
- `getCustomData()`
- `setCustomData(key, value)`
- `deleteCustomData(key)`

### 📤 Events
- `sendPage(extraData)` → Triggers a `page_load` event manually
- `sendEvent(name, extraData)` → Sends a custom event

### 🔧 Session Enhancement
- `addActivityData("user" | "visit", data)`
- `deleteActivityData("user" | "visit", key)`

---

## 🧪 Notes

- SPA support observes `pushState` and `popstate`.
- Core Web Vitals are deduplicated and batched.
- Adblock detection adds `is_adblock` to `visit_start`.
- Modular connector system allows routing events to multiple destinations.
- No third-party dependencies.