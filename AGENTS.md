# Firelink Backstage Plugin

## Project Overview

The Firelink plugin is a frontend-only Backstage plugin that displays ephemeral namespaces on OpenShift clusters managed by the Ephemeral Namespace Operator. It provides a read-only view of namespace status and reservation details, with links to the Firelink web application for mutating operations (reserve, deploy). The plugin is distributed both as a standard Backstage workspace dependency and as a dynamic plugin for Red Hat Developer Hub (RHDH).

## Dependencies

**Runtime:**
- React 16.13.1 / 17.0.0 / 18.0.0
- Backstage core (`@backstage/core-components`, `@backstage/core-plugin-api`, `@backstage/theme`)
- Material-UI v4 (`@material-ui/core`, `@material-ui/icons`, `@material-ui/lab`)

**Dev/Test:**
- `@backstage/cli` for build, test, and development tasks
- `@janus-idp/cli` for dynamic plugin export
- Jest 30.x with jsdom environment for unit tests
- Playwright for end-to-end tests
- TypeScript 5.8.0

**Build System:** Yarn 4.4.1 workspaces, managed by `@backstage/cli`

## Development Commands

See [Development][readme-dev] in the README for the full command reference and local setup instructions.

```sh
# Install dependencies
yarn install

# Start development server (full Backstage instance)
yarn start

# Run unit tests
yarn test

# Run tests with coverage
yarn test:all

# Run end-to-end tests
yarn test:e2e

# Lint all packages
yarn lint:all

# Check formatting
yarn prettier:check

# Auto-fix linting and formatting
yarn fix

# Build all packages
yarn build:all

# Build dynamic plugin for RHDH
cd plugins/firelink && yarn export-dynamic
```

**CI Status:** No CI workflows are currently configured. All dev tooling (ESLint, Prettier, Jest, Playwright) is present but not executed in automated pipelines.

## Architecture

The plugin is structured as a Yarn workspace monorepo:
- `plugins/firelink/` - The publishable plugin package (`@redhatinsights/backstage-plugin-firelink`)
- `packages/app/` - Development Backstage frontend
- `packages/backend/` - Development Backstage backend

The plugin itself consists of a single routable page component (`FirelinkComponent`) that fetches data from two Kubernetes API endpoints via Backstage's proxy mechanism and renders a table of ephemeral namespaces with their reservation status.

For detailed architecture, design decisions, and data flow, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Code Style

**Linter:** ESLint via `@backstage/cli` with minimal custom configuration (`.eslintrc.js` is a root-only stub)

**Formatter:** Prettier via `@backstage/cli/config/prettier`

**TypeScript:** Version 5.8.0 with Backstage's base config. JSX transform is `react-jsx` (automatic runtime).

**Line Length:** Follows Backstage defaults (typically 100 characters for code, 80 for comments)

**Workspace Conventions:**
- Plugin code lives in `plugins/firelink/src/`
- Exports must be declared in `plugins/firelink/src/index.ts`
- Component exports follow Backstage patterns (named exports for components, default exports discouraged)

## Common Mistakes

1. **Using Material-UI v5 patterns.** Backstage and this plugin are built on Material-UI v4. Attempting to use v5 APIs (e.g., `@mui/material`, `sx` prop, `styled` from `@mui/system`) will fail. Stick to v4 APIs (`@material-ui/core`, `makeStyles`, `withStyles`).

2. **Assuming the plugin has a backend.** This is a frontend-only plugin. All API calls go through Backstage's proxy (`/api/proxy/ephemeral`), not a custom backend plugin. Do not attempt to create backend routes or handlers.

3. **Hard-coding cluster URLs or tokens.** The plugin reads configuration from `app-config.yaml` via `configApiRef`. Never embed cluster URLs, tokens, or environment-specific values directly in the code.

4. **Forgetting to filter namespaces.** The raw Kubernetes API returns all namespaces, including system namespaces. The plugin filters to `ephemeral-*` namespaces that do not contain `system` in their name. Removing or modifying this filter will break the intended UX.

5. **Ignoring lint-staged configuration.** While `lint-staged` is configured in `package.json`, it is NOT enforced by a commit hook framework (no husky, no pre-commit). Manually run `yarn fix` before committing or your PR may fail review for style violations.

6. **Assuming dynamic plugin compatibility.** When modifying the plugin, ensure changes are compatible with Janus IDP's dynamic plugin system (Scalprum). Avoid backend dependencies, Node.js APIs, or features that require build-time code generation beyond what `@janus-idp/cli` supports.

## Testing

**Unit Tests:** Jest with `@testing-library/react` for component tests. Test files are colocated with source files (e.g., `FirelinkComponent.test.tsx` next to `FirelinkComponent.tsx`).

**E2E Tests:** Playwright tests in `packages/app/e2e-tests/` verify full-stack integration in a running Backstage instance.

**Running Tests:**
```sh
yarn test           # Run unit tests
yarn test:all       # Run with coverage
yarn test:e2e       # Run Playwright e2e tests
```

**Coverage:** Current test coverage is minimal. Existing tests verify plugin registration and basic component rendering but do not comprehensively validate API integration, error handling, or edge cases.

## Deployment

### Standalone Backstage

Install the plugin in a standard Backstage app by adding it as a workspace dependency and registering the route in `packages/app/src/App.tsx`:

```tsx
import { FirelinkPage } from '@redhatinsights/backstage-plugin-firelink';

// In your app routes:
<Route path="/firelink" element={<FirelinkPage />} />
```

### Red Hat Developer Hub (Dynamic Plugin)

Build the dynamic plugin:
```sh
cd plugins/firelink
yarn export-dynamic
```

The output in `dist-scalprum/` can be packaged and deployed to RHDH. See [README.md](./README.md#deploying-as-a-dynamic-plugin-rhdh) for configuration details.

[readme-dev]: ./README.md#development
