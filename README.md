# 📊 Activity Tracking Module

A lightweight JavaScript module for tracking user and session activity in client-side applications, with support for:

- Unique user & session identifiers (stored in both localStorage and cookies)
- Session engagement measurement
- Custom traffic source identifier
- Device type detection
- Configurable events pushed to the `dataLayer` (GTM-compatible)

---

## 🚀 Installation

Add the script directly to your HTML page:

```html
<script src="/path/to/activity-tracking.js"></script>
<script>
  initActivityTracking();
</script>
```

Or configure it with options:

```html
<script>
  initActivityTracking({
    visitEngagementDelay: 15000, // Delay before engagement is counted (in ms)
    sourceParams: ["utm_source", "utm_medium", "gclid", "fbclid"], // Custom traffic source keys
    exclusionList: ["paypal.com", "3dsecure"],
    cookieName: "uv_ids"
  });
</script>
```

---

## ⚙️ Configuration Options

| Option                 | Type     | Default                                       | Description |
|------------------------|----------|-----------------------------------------------|-------------|
| `userIdExpirationTime` | number   | `13 * 30 * 24 * 60 * 60 * 1000`               | User ID lifetime (13 months) |
| `visitIdExpirationTime`| number   | `30 * 60 * 1000`                              | Session lifetime (30 minutes) |
| `visitEngagementDelay` | number   | `10000`                                       | Delay before visit is considered "engaged" |
| `exclusionList`        | string[] | `["paypal.com", "3dsecure", "..."]`           | Referrers to exclude from source tracking |
| `sourceParams`         | string[] | `["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"]` | Query params considered as source |
| `cookieName`           | string   | `"uv_ids"`                                    | Cookie name used to store minimal IDs |

---

## 📦 Data Stored

- **localStorage**: `userActivity` (main session tracking object)
- **cookie**: `{ userId, visitId }` for server-side or cross-page use

---

## 📐 Device Type Detection

Automatically detects device type using the user agent:

- `"mobile"`
- `"tablet"`
- `"desktop"`

---

## 📤 Events (via `window.dataLayer.push()`)

All events are pushed to `window.dataLayer` automatically.

### `page_load`
Fired on every pageview.

```js
{
  event: "page_load",
  userActivity: { ... },         // full tracking state
  deviceType: "desktop"          // inferred from userAgent
}
```

### `first_visit`
Fired once per user (when a new user ID is created).

```js
{ event: "first_visit" }
```

### `visit_start`
Fired once per session (on first pageview of session).

```js
{ event: "visit_start" }
```

### `visit_engaged`
Fired only if the user stays active on the page for more than the engagement delay.

```js
{
  event: "visit_engaged",
  visit: {
    isEngaged: true
  }
}
```

### `new_visit_source`
Fired when a new traffic source is detected during an ongoing session.

```js
{ event: "new_visit_source" }
```

---

## 🧪 Example: `userActivity` Payload

```json
{
  "id": "c23b7a26-bf23-4c7d-90be-dcbfc0f84eaa",
  "expirationDate": 1786307089157,
  "lastActivity": 1752611103161,
  "landingPage": "https://example.com/?utm_source=google&utm_medium=cpc",
  "source": {
    "utm_source": "google",
    "utm_medium": "cpc"
  },
  "visit": {
    "id": "2ef84ec9-1989-4b5b-b180-1e7cb79aeec5",
    "expirationDate": 1752611403161,
    "landingPage": "https://example.com/?utm_source=google&utm_medium=cpc",
    "source": {
      "utm_source": "google",
      "utm_medium": "cpc"
    },
    "count": 1,
    "isEngaged": true
  },
}
```

---

## 🧪 Notes & Behavior

- Session and user IDs are regenerated only when expired.
- Traffic source detection ignores internal or excluded referrers.
- `visitEngaged` only fires once per session if the user is active for the configured time.

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).
