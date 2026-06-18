# Architecture

This document describes the internal architecture, design decisions, and key implementation details of the Firelink Backstage plugin.

## Overview

The Firelink plugin is a **frontend-only Backstage plugin** that provides visibility into ephemeral namespaces on OpenShift clusters managed by the [Ephemeral Namespace Operator](https://github.com/RedHatInsights/ephemeral-namespace-operator). It integrates with the [Firelink](https://github.com/RedHatInsights/firelink-frontend) application for namespace management operations.

## Architecture Decisions

### Frontend-Only Plugin

**Decision:** Implement as a pure frontend plugin with no custom backend components.

**Rationale:** The plugin relies entirely on the OpenShift cluster's Kubernetes API and the Firelink web application. All API communication happens through Backstage's built-in proxy mechanism, eliminating the need for a custom backend plugin.

**Tradeoff:** While this simplifies deployment and reduces maintenance overhead, it means authentication to the ephemeral cluster must be configured at the proxy level rather than being dynamically managed per-user.

### Proxy-Based API Access

**Decision:** Access the ephemeral cluster's Kubernetes API through Backstage's proxy endpoint (`/api/proxy/ephemeral`).

**Implementation:**
```yaml
proxy:
  endpoints:
    "/ephemeral":
      target: "${FIRELINK_EPHEMERAL_API_URL}"
      credentials: dangerously-allow-unauthenticated
      headers:
        Authorization: "Bearer ${FIRELINK_EPHEMERAL_API_TOKEN}"
      changeOrigin: true
```

**Rationale:** Backstage's proxy handles CORS, SSL, and authentication headers centrally. The plugin code remains environment-agnostic and doesn't embed cluster credentials.

**Tradeoff:** All users share a single cluster token (configured via `FIRELINK_EPHEMERAL_API_TOKEN`). This is acceptable for read-only operations but would not be suitable for write operations requiring user-level audit trails.

### Direct Links to Firelink

**Decision:** Use external links to Firelink for all mutating operations (reserve, deploy) rather than embedding forms or workflows in Backstage.

**Rationale:**
- Avoids duplicating Firelink's reservation and deployment UI logic.
- Ensures users interact with the authoritative source for namespace management.
- Simplifies the plugin codebase and maintenance.

**Tradeoff:** Users navigate away from Backstage to complete workflows. A fully integrated experience would require significant duplication of Firelink functionality.

### Namespace Filtering

**Decision:** Display only namespaces matching `ephemeral-*` that do not contain `system` in their name.

**Implementation:**
```typescript
const ephemeralNamespaces = data.items.filter(
  (namespace: any) =>
    namespace.metadata.name.startsWith('ephemeral-') &&
    !namespace.metadata.name.includes('system'),
);
```

**Rationale:** The ephemeral cluster contains many system and operator namespaces that are not relevant to developers. This filter narrows the view to user-managed ephemeral namespaces.

**Tradeoff:** If naming conventions change (e.g., a legitimate user namespace contains "system"), it will not appear in the table.

### Configuration via Environment Variables

**Decision:** Require four environment variables to be set and referenced in `app-config.yaml`:
- `FIRELINK_APP_URL` - Firelink frontend URL
- `FIRELINK_EPHEMERAL_CONSOLE_URL` - OpenShift console URL for the ephemeral cluster
- `FIRELINK_EPHEMERAL_API_URL` - Kubernetes API URL for the ephemeral cluster
- `FIRELINK_EPHEMERAL_API_TOKEN` - API token with read access to namespaces and NamespaceReservations

**Rationale:** Environment variables allow deployment-specific configuration without modifying the plugin code. This follows Backstage's standard configuration pattern.

**Tradeoff:** Deployment requires external configuration management. There is no in-plugin UI for setting these values.

## Component Structure

### Plugin Entry Point

**File:** `plugins/firelink/src/plugin.ts`

Defines the plugin using Backstage's plugin API:
- `firelinkPlugin` - The plugin instance with ID `firelink` and a single root route.
- `FirelinkPage` - A routable extension that lazy-loads the main component.

### Main Component

**File:** `plugins/firelink/src/components/FirelinkComponent/FirelinkComponent.tsx`

A single-page React component that:
1. Fetches data from two Kubernetes API endpoints on mount:
   - `/api/v1/namespaces` - List of all namespaces
   - `/apis/cloud.redhat.com/v1alpha1/namespacereservations` - NamespaceReservation CRs
2. Joins the two datasets to determine which namespaces are reserved and by whom.
3. Renders a table with namespace name, reservation status, phase, requester, pool type, and expiration.
4. Provides action buttons for Refresh, Reserve (link to Firelink), Deploy (link to Firelink), and Get Login Token (dynamically generated OAuth URL).

### State Management

**Decision:** Use React hooks (`useState`, `useEffect`) for all state management. No external state library (Redux, Zustand, etc.) is used.

**Rationale:** The plugin's state is simple and localized to a single component. Adding a state management library would be over-engineering for this use case.

**Tradeoff:** If the plugin grows to multiple pages with shared state, refactoring to a centralized state solution may become necessary.

### Token URL Generation

The "Get Login Token" button constructs an OAuth token display URL by transforming the ephemeral console URL:

```typescript
const regex = /^https:\/\/console-([^.]+)\.apps\.(.*)$/;
const match = ephemeralUrl.match(regex);
// Transforms:
//   https://console-openshift-console.apps.cluster.example.com
// To:
//   https://oauth-openshift.apps.cluster.example.com/oauth/token/display
```

**Rationale:** OpenShift's OAuth token display endpoint follows a predictable URL pattern. Deriving it from the console URL reduces required configuration.

**Tradeoff:** This logic is brittle and assumes a specific URL structure. Changes to OpenShift's routing or non-standard deployments may break this feature.

## Data Flow

1. **Component mounts** → `useEffect` triggers API calls.
2. **API calls** → `fetchApi.fetch()` calls to `/ephemeral` proxy endpoints.
3. **Response parsing** → Namespaces filtered by `ephemeral-*` prefix; NamespaceReservations stored.
4. **Data join** → For each namespace, find the matching NamespaceReservation by `status.namespace`.
5. **Render** → Table rows display joined data with links to Firelink.

## Dependencies

### Backstage Core

- `@backstage/core-plugin-api` - Plugin lifecycle, routing, and API access (configApiRef, fetchApiRef).
- `@backstage/core-components` - Reusable UI components (Header, Page, Content, ContentHeader).
- `@backstage/theme` - Theming support.

### Material-UI v4

**Decision:** Use Material-UI v4 (not v5).

**Rationale:** Backstage's stable releases are built on Material-UI v4. Using v5 would create version conflicts and styling inconsistencies.

**Tradeoff:** Material-UI v4 is no longer actively developed. Migration to v5 will be required when Backstage upgrades.

## Deployment Models

### Standalone Backstage

Install as a workspace dependency and register in `packages/app/src/App.tsx`:
```typescript
import { FirelinkPage } from '@redhatinsights/backstage-plugin-firelink';
// ...
<Route path="/firelink" element={<FirelinkPage />} />
```

### Red Hat Developer Hub (RHDH) Dynamic Plugin

The plugin is packaged as a dynamic plugin using `@janus-idp/cli`:
```bash
yarn workspace @redhatinsights/backstage-plugin-firelink export-dynamic
```

This generates a `dist-scalprum/` output that can be loaded at runtime by RHDH without rebuilding the entire Backstage app.

**Tradeoff:** Dynamic plugins have constraints (e.g., no backend components, limited to frontend extensions). The Firelink plugin's architecture already fits these constraints.

## Testing Strategy

- **Unit tests:** Jest tests for individual components (`plugin.test.ts`, `FirelinkComponent.test.tsx`).
- **E2E tests:** Playwright tests in `packages/app/e2e-tests/` verify the full integration in a running Backstage instance.

**Note:** Current test coverage is minimal. Tests exist but do not comprehensively validate API integration, error handling, or edge cases (e.g., malformed API responses).

## Known Limitations

1. **Single-token authentication:** All users share the same cluster access token. Per-user authentication would require a backend plugin or Backstage's Kubernetes provider integration.
2. **No offline support:** The plugin requires live API access. If the cluster is unreachable, the error message is generic and does not distinguish between network issues, authentication failures, or API schema changes.
3. **Hard-coded filtering logic:** The `ephemeral-*` / no-`system` filter is embedded in code rather than being configurable.
4. **OAuth URL derivation:** The "Get Login Token" button relies on a regex pattern that may not work for all OpenShift deployments.

## Future Considerations

- **Kubernetes provider integration:** Backstage has a native Kubernetes plugin and backend provider. Integrating with that system would enable per-user authentication and leverage Backstage's existing RBAC model.
- **Pagination:** The API calls fetch all namespaces at once. For clusters with hundreds of ephemeral namespaces, client-side or server-side pagination should be added.
- **Real-time updates:** The Refresh button requires manual interaction. WebSocket or Server-Sent Events could provide live updates as namespaces are created or expire.
- **Custom resource validation:** The plugin assumes NamespaceReservation CRs have a specific schema (`spec.requester`, `status.namespace`, `status.expiration`). API validation or fallback handling would improve resilience.
