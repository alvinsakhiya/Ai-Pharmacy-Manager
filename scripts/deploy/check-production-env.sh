#!/usr/bin/env bash
# Pre-deploy check: required production environment variables are present and not
# left at a development default. Prints only pass/fail — never the secret values.
#
# Usage (from the repo root, on the deploy host):
#   set -a && . ./.env && set +a
#   ./scripts/deploy/check-production-env.sh
#
# The dev-default values below are the non-secret fallbacks committed in
# backend/config/settings/base.py; they must never be used in production.

set -u

DEV_SECRET="unsafe-development-key"
DEV_FIELD_KEY="YaKhc3E0z_nLejfE-AK0J6LQJS6RCfoaL8lctbICjwM="
DEV_INDEX_KEY="dev-only-patient-index-key-not-secret"

fail=0

require() { # require VAR "label"
	local val="${!1:-}"
	if [ -z "$val" ]; then
		echo "  FAIL  $2 (\$$1) is not set"
		fail=1
	else
		echo "  ok    $2 (\$$1) is set"
	fi
}

not_default() { # not_default VAR devdefault "label"
	if [ "${!1:-}" = "$2" ]; then
		echo "  FAIL  $3 (\$$1) is the dev default — rotate it before deploying"
		fail=1
	fi
}

equals() { # equals VAR expected "label"
	if [ "${!1:-}" != "$2" ]; then
		echo "  FAIL  $3 (\$$1) should be '$2'"
		fail=1
	fi
}

echo "Checking production environment..."

equals DJANGO_SETTINGS_MODULE "config.settings.prod" "settings module"

require DJANGO_SECRET_KEY "Django secret key"
not_default DJANGO_SECRET_KEY "$DEV_SECRET" "Django secret key"

require PATIENT_FIELD_KEY "patient field key"
not_default PATIENT_FIELD_KEY "$DEV_FIELD_KEY" "patient field key"

require PATIENT_INDEX_KEY "patient index key"
not_default PATIENT_INDEX_KEY "$DEV_INDEX_KEY" "patient index key"

require BACKUP_ENCRYPTION_KEY "backup encryption key"
require DATABASE_URL "database URL"
require DJANGO_ALLOWED_HOSTS "allowed hosts"
require CSRF_TRUSTED_ORIGINS "CSRF trusted origins"
require CORS_ALLOWED_ORIGINS "CORS allowed origins"

case "${POSTGRES_PASSWORD:-}" in
	pharmacy | "")
		echo "  FAIL  database password (\$POSTGRES_PASSWORD) is weak or default"
		fail=1
		;;
esac

case "$(printf '%s' "${DJANGO_DEBUG:-}" | tr '[:upper:]' '[:lower:]')" in
	1 | true | yes | on)
		echo "  FAIL  \$DJANGO_DEBUG must not be truthy in production"
		fail=1
		;;
esac

if [ "$fail" -ne 0 ]; then
	echo "Environment check FAILED. Fix the items above before deploying."
	exit 1
fi

echo "Environment check passed."
