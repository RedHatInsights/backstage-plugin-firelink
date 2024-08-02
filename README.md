# [Backstage](https://backstage.io)

This is your newly scaffolded Backstage App, Good Luck!

To start the app, run:

```sh
yarn install
yarn dev
```
## Configuration
You'll need to set 4 environment variables for the plugin to function:

```sh
# The URL to your firelink-frontend instance
export FIRELINK_APP_URL="https://firelink.my-company.com"

# The URL to the cloud console for your ephemeral cluster
export FIRELINK_EPHEMERAL_CONSOLE_URL="https://console-openshift-console.apps.my-cluster.my-company.openshiftapps.com"

# The URL to your ephemeral cluster's API, including port
export FIRELINK_EPHEMERAL_API_URL="https://api.my-cluster.my-company.openshiftapps.com:6443"

# The token for accessing your ephemeral cluster API
export FIRELINK_EPHEMERAL_API_TOKEN="sha256~DEADBEEF7337DEADBEEF7337DEADBEEF7337DEADBEEF7337"
```

You'll then need to add the following to your `app-config.yaml`

```yaml
app:
  firelink:
    firelinkUrl: ${FIRELINK_APP_URL}
    ephemeralUrl: ${FIRELINK_EPHEMERAL_CONSOLE_URL}

proxy:
  endpoints:
    "/ephemeral":
      target: "${FIRELINK_EPHEMERAL_API_URL}"
      credentials: dangerously-allow-unauthenticated
      headers:
        Authorization: "Bearer ${FIRELINK_EPHEMERAL_API_TOKEN}"
      changeOrigin: true
```