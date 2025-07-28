# 📊 Activity Tracking Module

A lightweight JavaScript module for tracking user and session activity in client-side applications, with support for:

- Unique user & session identifiers (stored in both `localStorage` and cookies)
- Session timeout and engagement measurement
- UTM and referrer-based source tracking
- SPA navigation tracking (optional)
- Set any custom date (`customData` object)
- Flexible event dispatching (`eventDispatcher`)
- Device type detection
- Public API exposed as `window.ActivityTracking`

---

## 🚀 Installation

Include the script and call `ActivityTracking.init()`:

```html
<script src="https://yourcdn.com/ActivityTracking.js"></script>
<script>
  ActivityTracking.init();
</script>
```

Or with configuration:

```js
ActivityTracking.init({
  visitEngagementDelay: 15000,
  sourceParams: ["utm_source", "utm_medium", "gclid"],
  exclusionList: ["paypal.com", "3dsecure"],
  trackSpaPages: true,
  cookieName: "uv_ids",
  eventDispatcher: function(event) {
    // Send to a custom analytics backend
    myAnalytics.track(event.event, event);
  }
});
```

---

## ⚙️ Configuration Options

| Option                  | Type         | Default                                          | Description |
|-------------------------|--------------|--------------------------------------------------|-------------|
| `userIdExpirationTime`  | number       | `13 * 30 * 24 * 60 * 60 * 1000` (13 months)      | Lifetime of the user ID |
| `visitIdExpirationTime` | number       | `30 * 60 * 1000` (30 min)                        | Session timeout duration |
| `visitEngagementDelay`  | number       | `10000` (10 sec)                                 | Delay to consider the visit as engaged |
| `exclusionList`         | string[]     | `["paypal.com", "3dsecure", "..."]`              | Referrers to exclude from source tracking |
| `sourceParams`          | string[]     | `["utm_source", "utm_medium", "utm_campaign", ...]` | Query params to detect source |
| `cookieName`            | string       | `"uv_ids"`                                       | Cookie name to store user/session IDs |
| `trackSpaPages`         | boolean      | `true`                                           | Automatically track SPA route changes |
| `eventDispatcher`       | function or null | `null`                                      | Custom function to handle events (fallback: `window.dataLayer.push`) |

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

### `first_visit`

Fired for a new user (no prior ID or expired).

### `visit_start`

Fired at the beginning of a new session.

### `visit_engaged`

Fired after a delay if user stays on page long enough.

```js
{
  event: "visit_engaged",
  visit: { isEngaged: true }
}
```

### `new_visit_source`

Fired when the UTM/referrer changes mid-session.

---

## 📦 Data Storage

- **localStorage**: stores full user/session data under the key `userActivity`
- **Cookies**: stores `{ userId, visitId }` under the configured `cookieName`

---

## 📐 Device Type Detection

Automatically detects device type using `navigator.userAgent`.

Possible values:

- `"desktop"`
- `"mobile"`
- `"tablet"`

---

## 📐 SPA Navigation Support

If `trackSpaPages: true`, the module listens to:

- `history.pushState`
- `popstate`

On each navigation change, it dispatches a new `page_load` event with the updated path.

---

## 🧰 Public API

Accessible via `window.ActivityTracking`:

| Method | Description |
|--------|-------------|
| `init(userConfig)` | Initializes or reinitializes tracking |
| `getUserId()` | Returns the current user ID |
| `getVisitId()` | Returns the current visit ID |
| `getCustomData()` | Returns the custom metadata object |
| `setCustomData(key, value)` | Sets a custom key/value in session data |
| `deleteCustomData(key)` | Removes a key from `customData` |
| `getAllData()` | Returns the full user/session object |
| `config` | The current merged configuration object |

---

### ✅ Example

```js
ActivityTracking.setCustomData("userType", "premium");
ActivityTracking.deleteCustomData("userType");

console.log(ActivityTracking.getUserId());
console.log(ActivityTracking.getAllData());
```

---

## 🧪 Notes

- If `eventDispatcher` is `null`, falls back to `window.dataLayer.push()`
- If `window.dataLayer` does not exist, it is automatically initialized
- `customData` is stored in `localStorage` and persists across visits
- All logic is client-side — no third-party dependencies
- Engagement tracking is independent per tab/session