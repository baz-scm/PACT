#!/bin/sh
set -e
command -v node >/dev/null 2>&1 || { echo "error: node.js is required (https://nodejs.org)"; exit 1; }
npx --yes @baz-scm/pact-hooks@latest install "$@"
