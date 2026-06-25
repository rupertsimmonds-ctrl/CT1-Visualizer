# First-party Google OAuth for CT1 automation

This replaces the OAuth Playground tokens (1-hour access tokens, no usable
refresh, one scope per paste) with a **first-party OAuth client in our own
Google Cloud project** plus a long-lived refresh token. The agent (or any
script) then mints fresh access tokens on demand via
[`mint_access_token.py`](./mint_access_token.py) — no more racing the 1-hour
clock.

> **The repo is public. No secrets go in it.** `client_secret` and
> `refresh_token` live only in environment variables (preferred) or a local
> out-of-tree creds file. Both are gitignored.

## Scopes this setup grants

| Scope | For |
| --- | --- |
| `https://www.googleapis.com/auth/script.projects` | read/update the viewings Apps Script content + versions |
| `https://www.googleapis.com/auth/script.deployments` | publish `/exec` web-app deployments |
| `https://www.googleapis.com/auth/spreadsheets` | read/write the Control Centre + shared viewings sheets |
| `https://www.googleapis.com/auth/calendar` | create/delete City Tower viewing events |
| `https://www.googleapis.com/auth/drive` | read/write Drive (find sheets/scripts, manage files) |

> `drive` is full read/write. If you want to scope down later,
> `drive.file` (only files the app touches) or `drive.readonly` are narrower
> alternatives — but `drive` matches the "read and write Drive" ask.

## One-time setup in Google Cloud Console

You've created the GCP project; finish these steps in it.

### 1. Enable the APIs
APIs & Services → **Enable APIs and Services**, enable all of:
- **Apps Script API**
- **Google Sheets API**
- **Google Calendar API**
- **Google Drive API**

### 2. OAuth consent screen → **Internal**
APIs & Services → OAuth consent screen → User type **Internal**.
- Internal is the right choice: the project lives in the **bhomes.com**
  Workspace, so only org users can consent — **no Google verification needed**,
  and (critically) **refresh tokens don't expire after 7 days** the way they do
  while an External app is in "Testing" status.
- Add the five scopes above under "Scopes".

### 3. Create the OAuth client
APIs & Services → Credentials → **Create Credentials → OAuth client ID**.
- Application type: **Web application**.
- Under **Authorized redirect URIs** add:
  `https://developers.google.com/oauthplayground`
  (this lets you mint the refresh token through the Playground UI you already
  know — see next section).
- Save. Copy the **Client ID** and **Client secret**.

### 4. Mint the refresh token (Playground, using YOUR client)
1. Open <https://developers.google.com/oauthplayground>.
2. Click the **⚙ gear** (top right) → tick **"Use your own OAuth credentials"**
   → paste your **Client ID** and **Client secret**.
3. In "Step 1 — Select & authorize APIs", paste all five scopes (space- or
   line-separated) into the "Input your own scopes" box and **Authorize APIs**.
   Sign in as a bhomes.com user and consent.
4. In "Step 2", click **Exchange authorization code for tokens**.
5. Copy the **Refresh token** (and Client ID / secret). That refresh token is
   long-lived because the consent screen is Internal.

## Give the credentials to the agent

**Preferred — environment variables (persist across sessions).** Add these as
environment variables / secrets on the Claude Code web environment
(see https://code.claude.com/docs/en/claude-code-on-the-web):

```
GOOGLE_OAUTH_CLIENT_ID=<client id>
GOOGLE_OAUTH_CLIENT_SECRET=<client secret>
GOOGLE_OAUTH_REFRESH_TOKEN=<refresh token>
```

Once set, every session can mint tokens with no manual step.

**Fallback — local creds file (this session only).** If you'd rather just paste
them to me in chat, I'll write them to a gitignored, out-of-tree file:

```json
{ "client_id": "...", "client_secret": "...", "refresh_token": "..." }
```
at the path printed by `python3 scripts/google-oauth/mint_access_token.py --where`.
This is ephemeral (gone when the container is reclaimed), so the env-var route
is better for durable use.

## Usage

```bash
# raw access token (for command substitution)
TOKEN=$(python3 scripts/google-oauth/mint_access_token.py)

# inspect what you got (scopes + expiry)
python3 scripts/google-oauth/mint_access_token.py --verbose

# example call
curl -H "Authorization: Bearer $TOKEN" \
  https://script.googleapis.com/v1/projects/<scriptId>/content
```

## Troubleshooting

- **`invalid_grant`** on refresh → the refresh token was revoked or expired.
  Most common cause: the consent screen is still **External + Testing**, which
  caps refresh tokens at 7 days. Switch to **Internal** (step 2) and re-mint.
- **`insufficient authentication scopes` / 403** → the refresh token was minted
  without one of the five scopes. Re-run step 4 with all scopes selected.
- **`access_denied`** at consent → the signing-in user isn't in the bhomes.com
  org (Internal apps only allow org users).
