#!/usr/bin/env bash
# Deploy the test build to Google Cloud Run (docs/deploy.md).
#
#   scripts/deploy-cloudrun.sh <project-id> [--region asia-northeast1]
#                              [--service wonderlab] [--env-file .env] [--dry-run]
#
# Run it on your own computer, signed in with `gcloud auth login`. It reads
# the TokenStars key, the model and the invite tokens from your local .env
# and stores the secret ones in Secret Manager: they never go into the image,
# the repository or a chat. Safe to run again: it redeploys the current code
# and keeps the settings already there.
#
# --dry-run prints every command instead of running it.

set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

PROJECT=""
REGION="asia-northeast1"
SERVICE="wonderlab"
ENV_FILE=".env"
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage 0 ;;
    -*) echo "unknown option: $1" >&2; usage 1 ;;
    *) PROJECT="$1"; shift ;;
  esac
done
[ -n "$PROJECT" ] || { echo "the Google Cloud project id is required" >&2; usage 1; }
cd "$(dirname "$0")/.."
[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE here; copy .env.example and fill in the TokenStars part" >&2; exit 1; }

# One value from the env file, parsed by Node exactly as the server parses it.
env_value() {
  node -e 'process.loadEnvFile(process.argv[1]); process.stdout.write(process.env[process.argv[2]] ?? "")' "$ENV_FILE" "$1"
}

# Show what runs; with --dry-run, only show it. Secret values never appear:
# they are piped in, not passed as arguments.
run() {
  printf '+ %s\n' "$*" >&2
  [ "$DRY" = 1 ] || "$@"
}

API_KEY="$(env_value TOKENSTARS_API_KEY)"
MODEL="$(env_value TOKENSTARS_MODEL_ID)"
INVITES="$(env_value INVITE_TOKENS)"
BASE_URL="$(env_value TOKENSTARS_BASE_URL)"
if [ -z "$API_KEY" ] || [ -z "$MODEL" ] || [ -z "$INVITES" ]; then
  echo "warning: TOKENSTARS_API_KEY, TOKENSTARS_MODEL_ID or INVITE_TOKENS is empty in $ENV_FILE;" >&2
  echo "         the site will work, with 一句成境 on local rules only." >&2
fi

SECRET_KEY="$SERVICE-tokenstars-api-key"
SECRET_INVITES="$SERVICE-invite-tokens"
SECRET_SALT="$SERVICE-scene-cache-salt"

echo "== project $PROJECT, region $REGION, service $SERVICE" >&2
run gcloud config set project "$PROJECT"
run gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create a secret if it is missing; add a version when a value is given.
put_secret() {
  local name="$1" value="$2" from="${3:-$ENV_FILE}"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    run gcloud secrets create "$name" --replication-policy=automatic
  fi
  if [ -n "$value" ]; then
    printf '+ (value from %s) | gcloud secrets versions add %s --data-file=-\n' "$from" "$name" >&2
    [ "$DRY" = 1 ] || printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  fi
}

echo "== secrets" >&2
put_secret "$SECRET_KEY" "$API_KEY"
put_secret "$SECRET_INVITES" "$INVITES"
# The cache salt is made once and then kept, so cache keys survive redeploys.
if ! gcloud secrets describe "$SECRET_SALT" >/dev/null 2>&1; then
  put_secret "$SECRET_SALT" "$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')" "a fresh random salt"
fi

# The service runs as the default compute account; let it read the three secrets.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null || echo PROJECT_NUMBER)"
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for s in "$SECRET_KEY" "$SECRET_INVITES" "$SECRET_SALT"; do
  run gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$RUNTIME_SA" --role=roles/secretmanager.secretAccessor --condition=None --quiet
done

# Plain settings: the model, and the spending caps when .env sets them.
ENV_VARS="TOKENSTARS_MODEL_ID=$MODEL"
[ -n "$BASE_URL" ] && ENV_VARS="$ENV_VARS@TOKENSTARS_BASE_URL=$BASE_URL"
for k in SCENE_DAILY_PER_INVITE SCENE_DAILY_BUDGET_JPY SCENE_TOTAL_BUDGET_JPY TOKENSTARS_COST_MINOR_PER_REQUEST; do
  v="$(env_value "$k")"
  [ -n "$v" ] && ENV_VARS="$ENV_VARS@$k=$v"
done

echo "== build and deploy (Cloud Build runs the Dockerfile; a few minutes)" >&2
# One instance: the AI spending caps are counted in the process (docs/deploy.md).
run gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 --memory 512Mi \
  --min-instances 0 --max-instances 1 \
  "--update-env-vars=^@^$ENV_VARS" \
  --update-secrets "TOKENSTARS_API_KEY=$SECRET_KEY:latest,INVITE_TOKENS=$SECRET_INVITES:latest,SCENE_CACHE_SALT=$SECRET_SALT:latest"

if [ "$DRY" = 1 ]; then
  echo "== dry run: would now read the service URLs and set PUBLIC_WEB_URL, PUBLIC_API_URL and ALLOWED_ORIGINS" >&2
  exit 0
fi

# /api/scene only answers its own origin; tell it which one that is. Cloud
# Run answers on two addresses; the other one goes into ALLOWED_ORIGINS.
echo "== tell the service its own address" >&2
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
ALL_URLS="$(gcloud run services describe "$SERVICE" --region "$REGION" --format=json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).metadata?.annotations?.["run.googleapis.com/urls"];process.stdout.write(a?JSON.parse(a).join(","):"")})')"
OTHERS="$(printf '%s' "$ALL_URLS" | tr ',' '\n' | grep -vx "$URL" | paste -sd, - || true)"
run gcloud run services update "$SERVICE" --region "$REGION" \
  "--update-env-vars=^@^PUBLIC_WEB_URL=$URL@PUBLIC_API_URL=$URL@ALLOWED_ORIGINS=$OTHERS"

echo "== check" >&2
curl -fsS "$URL/api/health" && echo >&2
cat >&2 <<EOT

Deployed: $URL
  Fresh world:         $URL/?fresh
  With AI (one token): $URL/?fresh#invite=<one of INVITE_TOKENS>
  Moderator link:      $URL/?fresh&mod#invite=<token>
Then go through the checklist at the end of docs/deploy.md.
EOT
