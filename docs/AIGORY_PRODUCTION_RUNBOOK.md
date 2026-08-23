# Aigory production runbook

This runbook is for the single Oracle ARM64 host at `158.178.236.98` and the
Cloudflare zone `aigory.com`. Production releases are immutable Git commits.

## Required external setup

- `aigory.com`, `www.aigory.com`, `mcp.aigory.com`, and `cdn.aigory.com` must
  be proxied Cloudflare DNS records for the Oracle origin.
- `aigory-blog-prod-media` and `aigory-blog-prod-backups` must remain private.
- The CDN Worker must have a read-only OCI PAR in `ORIGIN_BASE_URL`; never
  expose the backup bucket through a PAR.
- OAuth consoles must use these exact callbacks, without wildcard matching:
  - `https://aigory.com/api/v1/auth/google/callback`
  - `https://aigory.com/api/v1/auth/github/callback`
  - `https://aigory.com/api/v1/auth/kakao/callback`
- SMTP authentication must succeed for an active sender identity.

## Create the protected environment

Generate fresh application, database, Redis, and Grafana secrets while
carrying forward only the external integration credentials:

```bash
node scripts/render-aigory-production-env.mjs \
  --source /path/to/previous/.env.production \
  --output /tmp/aigory-production.env
```

Review names and non-secret policy values without printing credential values:

```bash
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' \
  /tmp/aigory-production.env | sort
grep -E '^(NEXT_PUBLIC_SITE_URL|PAYMENTS_ENABLED|MOCK_PAYMENT_ENABLED|ADMIN_DEBUG_ENABLED|BACKUP_S3_BUCKET)=' \
  /tmp/aigory-production.env
```

Store the encoded file in the protected GitHub `production` environment:

```bash
base64 < /tmp/aigory-production.env | tr -d '\n' | \
  gh secret set AIGORY_ENV_FILE_BASE64 --env production -R beyondeth/my-blog-app
```

Create the deployment credentials under the same `AIGORY_` prefix:
`AIGORY_DEPLOY_HOST`, `AIGORY_DEPLOY_USER`, and `AIGORY_DEPLOY_SSH_KEY`.
Verify one manual deployment with these new secrets before removing the old
generic `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `ENV_FILE` secrets.

The deployment preflight blocks the cutover if production validation, either
OCI bucket, or SMTP authentication fails.

## Release and first cutover

1. Merge the hardened release into `main` and let `Aigory production quality`
   run on the merge commit.
2. For the first deployment only, dispatch `Deploy Aigory to Oracle` manually
   with that full SHA and set `initial_cutover=true`.
3. After the first cutover succeeds, every later `main` push is deployed
   automatically after the matching quality workflow succeeds.
4. Keep `initial_cutover=false` for every later manual deployment or rollback.

The automatic workflow uses the quality workflow's exact `head_sha`; it never
rebuilds or deploys an untested commit. Manual dispatch remains available for
the first cutover and rollback to a known SHA.

The initial cutover permanently removes only these exact legacy targets after
the new database migration and integration preflight succeed:

- containers whose names begin with `aigory-prod-`
- `/opt/aigory/app`
- `/mnt/data/aigory`
- the old Compose network and volumes labeled for `aigory-prod`

No legacy material-management backup is created. Later releases must keep
`initial_cutover=false`.

## Verification

```bash
curl --fail https://aigory.com/
curl --fail https://aigory.com/api/v1/health
curl --fail https://mcp.aigory.com/health
test "$(curl -sS -o /dev/null -w '%{http_code}' https://aigory.com/pricing)" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' https://aigory.com/admin/debug)" = 404
ssh ubuntu@158.178.236.98 'sudo systemctl status aigory-blog-backup.timer --no-pager'
ssh ubuntu@158.178.236.98 'sudo systemctl status aigory-blog-backup.service --no-pager'
```

Also complete one real OAuth login, create one post, upload one image, verify
the image through `cdn.aigory.com`, and confirm a backup dump plus checksum in
the private backup bucket before declaring the cutover complete.

Remove the local generated environment after GitHub and Oracle contain the
validated copy:

```bash
rm -f /tmp/aigory-production.env
```
