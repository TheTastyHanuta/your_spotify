#!/bin/sh

# nginx serves build/, the output of the package built at build-time.
# Unknown paths get index.html so that react can handle the router.
exec nginx -c /app/apps/client/scripts/run/nginx.conf -g "daemon off;"
