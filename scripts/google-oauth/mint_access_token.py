#!/usr/bin/env python3
"""Mint a fresh Google API access token from a long-lived refresh token.

This is the durable replacement for the OAuth Playground tokens (which expire
in 1 hour and can't be refreshed in an unattended context). It reads a
first-party OAuth client's credentials + a refresh token and exchanges them
for a short-lived access token on demand — so any script/agent can get a
valid token whenever it needs one, no manual re-pasting.

Credentials are read from the environment (preferred — set them as
environment variables / secrets on the Claude Code web environment so they
persist across sessions):

    GOOGLE_OAUTH_CLIENT_ID
    GOOGLE_OAUTH_CLIENT_SECRET
    GOOGLE_OAUTH_REFRESH_TOKEN

Fallback: a JSON file at $GOOGLE_OAUTH_CREDS_FILE (or, if unset, the path
printed by --where), containing {"client_id","client_secret","refresh_token"}.
NEVER commit that file — it holds long-lived secrets and this repo is public.

Usage:
    TOKEN=$(python3 scripts/google-oauth/mint_access_token.py)        # raw token
    python3 scripts/google-oauth/mint_access_token.py --verbose       # + scopes/expiry
    python3 scripts/google-oauth/mint_access_token.py --where         # creds file path

Then, e.g.:
    curl -H "Authorization: Bearer $TOKEN" \\
      https://script.googleapis.com/v1/projects/<id>/content
"""
import json
import os
import sys
import urllib.parse
import urllib.request

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

# Default location for the optional creds file: outside the repo tree, in the
# per-session scratchpad, so it can never be staged/committed by accident.
DEFAULT_CREDS_FILE = os.path.join(
    os.environ.get(
        "CLAUDE_SCRATCHPAD",
        os.path.expanduser("~/.config/ct1-google-oauth"),
    ),
    "google-oauth-creds.json",
)


def _creds_file_path():
    return os.environ.get("GOOGLE_OAUTH_CREDS_FILE", DEFAULT_CREDS_FILE)


def load_creds():
    """Env vars win; fall back to a local (gitignored / out-of-tree) JSON file."""
    cid = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    refresh = os.environ.get("GOOGLE_OAUTH_REFRESH_TOKEN")
    if cid and secret and refresh:
        return cid, secret, refresh

    path = _creds_file_path()
    if os.path.exists(path):
        with open(path) as fh:
            data = json.load(fh)
        cid = cid or data.get("client_id")
        secret = secret or data.get("client_secret")
        refresh = refresh or data.get("refresh_token")

    missing = [
        name
        for name, val in (
            ("client_id", cid),
            ("client_secret", secret),
            ("refresh_token", refresh),
        )
        if not val
    ]
    if missing:
        sys.exit(
            "ERROR: missing credential(s): "
            + ", ".join(missing)
            + ".\nSet GOOGLE_OAUTH_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN "
            + "in the environment, or put them in "
            + path
            + "\n(see scripts/google-oauth/README.md)."
        )
    return cid, secret, refresh


def mint(cid, secret, refresh):
    body = urllib.parse.urlencode(
        {
            "client_id": cid,
            "client_secret": secret,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        }
    ).encode()
    req = urllib.request.Request(
        TOKEN_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")
        sys.exit(
            "ERROR: token endpoint returned HTTP %s\n%s\n"
            "If this is 'invalid_grant', the refresh token was revoked/expired "
            "(e.g. the OAuth consent screen is still in 'Testing' status, which "
            "caps refresh tokens at 7 days) — see README." % (err.code, detail)
        )


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    if "--where" in sys.argv:
        print(_creds_file_path())
        return
    cid, secret, refresh = load_creds()
    tok = mint(cid, secret, refresh)
    if verbose:
        print("access_token:", tok.get("access_token"))
        print("expires_in:  ", tok.get("expires_in"), "seconds")
        print("scope:       ", tok.get("scope"))
        print("token_type:  ", tok.get("token_type"))
    else:
        # Raw token only, so `TOKEN=$(... )` works cleanly.
        sys.stdout.write(tok.get("access_token", ""))


if __name__ == "__main__":
    main()
