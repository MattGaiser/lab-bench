# Firebase Hosting and Cloud Run

[Firebase Hosting](https://firebase.google.com/docs/hosting/cloud-run) serves the static app independently of the API. Only `/api/**` is rewritten to the `lab-bench` Cloud Run service in `us-central1`. The editor, walkthrough, simulation, and local draft storage require no backend connection.

On the AI lesson form, a connection taking longer than 1.5 seconds shows a prominent panel explaining that Cloud Run may be warming up. Users can keep writing. A successful status response removes the panel; a failed or timed-out check offers **Retry connection** and the sample editor without losing the typed request. Status checks wait up to 30 seconds. Paid drafting requests are never retried automatically.

## Current deployment

The public demo is **[lab-bench-gaiser.web.app](https://lab-bench-gaiser.web.app)** in the existing `codeforcanada` project. Its dedicated Firebase site is `lab-bench-gaiser`; `firebase.json` names it explicitly so updates target that site.

| Resource                 | Name                                                      |
| ------------------------ | --------------------------------------------------------- |
| Cloud Run service        | `lab-bench`, region `us-central1`                         |
| Runtime identity         | `lab-bench-runtime@codeforcanada.iam.gserviceaccount.com` |
| API-key secret           | `lab-bench-openai-key`, version `1`                       |
| Private allowance bucket | `codeforcanada-lab-bench-usage`                           |

Allowed origins are the site's `.web.app` and `.firebaseapp.com` addresses, plus `https://lab-bench-464580910450.us-central1.run.app` and `https://lab-bench-ziq2cxy5xq-uc.a.run.app`. The Cloud Run hostnames are included because Firebase forwards requests to that service. The service and revision both have a maximum of one instance and no minimum instances.

## Runtime configuration

The included Dockerfile builds the app and copies only the assets, dependency-free server, and shared domain modules into the runtime image. Cloud Run sets `PORT` and `K_SERVICE`; the server then listens on `0.0.0.0`. Local execution still binds to `127.0.0.1`.

| Setting           | Purpose                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGINS`  | Comma-separated exact HTTPS origins for the Firebase site and Cloud Run URL. Hosts must match this list; paid POSTs must include an allowed Origin.           |
| `OPENAI_API_KEY`  | Runtime secret from Secret Manager, never a build argument or frontend variable.                                                                              |
| `AI_USAGE_BUCKET` | Private Cloud Storage bucket containing `assistant-usage.json`. The runtime service account needs object read/create/replace permissions on this bucket only. |
| `OPENAI_MODEL`    | Optional structured-output model override; defaults to the model documented in the README.                                                                    |

Use a dedicated runtime service account with access to the one API-key secret and the one usage bucket. Do not grant it project-wide editor or owner permissions. Configure zero minimum instances, a service-level maximum of one instance, 512 MiB memory, and a 50-second request timeout. Firebase Hosting's rewrite deadline is 60 seconds.

## Public AI allowance

Before each provider attempt, the server atomically reserves one request in private Cloud Storage. The shared allowance is **25 attempts per UTC day and 100 attempts in total**. Generation preconditions prevent simultaneous instances from spending the same remaining slot. Daily rollover does not reset the total; restarts and deployments preserve both counters. Failed provider attempts consume their reservation. Invalid input does not. If storage is unavailable or malformed, no provider request is sent.

This is a public demo, without individual accounts. An Origin header is browser protection, not user authentication; direct clients can forge it. The durable allowance bounds provider attempts across all visitors. It is not a dollar budget or a cap on Google Cloud infrastructure charges. Each provider attempt retains the 1,800-output-token limit and the overall 30-second deadline, including allowance reservation. The service also permits only one active request per process.

Keep the usage bucket private and retain its counter when deploying. Removing it resets the allowance. Replenishment is an explicit owner operation, not an automatic deployment step. When the allowance is exhausted, editing and simulation continue to work.

## Updating a configured deployment

Use the deployment's project ID explicitly; do not rely on an unrelated active gcloud project.

```sh
npm ci
npm run check
gcloud run deploy lab-bench --source . --project codeforcanada --region us-central1
firebase deploy --only hosting --project codeforcanada
```

For initial setup, enable Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Storage, and Firebase Hosting in a billing-enabled project. Create the dedicated identity, private usage bucket, and API-key secret before enabling the public API. Configure the origins and quota bucket, map the secret to `OPENAI_API_KEY`, and allow unauthenticated invocation so Firebase Hosting can reach the API. Add Firebase to the project and create its Hosting site before deploying `firebase.json`.

The Firebase CLI uses its own login (`firebase login`). The [Hosting REST API](https://firebase.google.com/docs/hosting/api-deploy) also supports deployment with a gcloud access token and the `x-goog-user-project: codeforcanada` header. For a different project, change the explicit Hosting site, resource names, and origins as well as the command's project argument.

The source upload allowlist excludes local environment files, generated packages, credentials, and browser reports. Review `gcloud meta list-files-for-upload` before a source deployment. `npm run build` creates `dist`, which is the only directory uploaded by Firebase Hosting.

After deployment, verify the public homepage, security headers, static assets, `/api/assistant/status`, a real bounded AI draft, and the authoring/preview/export flow. Test the delayed connection panel with a deliberately delayed status response; a naturally fast request should not show a misleading startup notice.
