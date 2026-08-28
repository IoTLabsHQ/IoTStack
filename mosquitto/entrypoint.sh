#!/bin/sh
set -e

# Same permission fix the image's own entrypoint does — needed because the
# named volumes Docker creates for /mosquitto/data and /mosquitto/log start
# out root-owned.
if [ "$(id -u)" = "0" ]; then
	chown -R mosquitto:mosquitto /mosquitto || true
fi

CONFIG_FILE=/mosquitto/data/dynamic-security.json
FRESH_INIT=0

if [ ! -f "$CONFIG_FILE" ]; then
	echo "bootstrapping dynamic-security.json with controller account..."
	mosquitto_ctrl dynsec init "$CONFIG_FILE" "$DYNSEC_CONTROLLER_USERNAME" "$DYNSEC_CONTROLLER_PASSWORD"
	FRESH_INIT=1
	# dynsec init writes this file as whatever user runs this script (root,
	# at this point) — re-chown so the mosquitto user (dropped to below) can
	# actually read it.
	if [ "$(id -u)" = "0" ]; then
		chown mosquitto:mosquitto "$CONFIG_FILE"
	fi
fi

# --- TLS: pick up the certificate Caddy obtained for DOMAIN, if any -------
#
# Caddy and this container share the same named volume (caddy_data on the
# Caddy side, mounted read-only here as /certs), so once Caddy has issued a
# cert it's visible here at Caddy's own default storage layout. Mosquitto
# can't read the mounted config directory (read-only) or that path directly
# (cert/key must sit next to each other under a path mosquitto can read at
# TLS-listener-setup time), so this copies them into the mosquitto data
# volume and writes a listener snippet under conf.d, then reloads if the
# broker is already running.
#
# This only takes effect once a domain is set (from the dashboard's
# Settings page — see DOMAIN_FILE below) and Caddy has actually finished an
# ACME issuance for it — until then mosquitto just runs without 8883, no
# error.
DOMAIN_FILE=/settings-shared/domain.txt

sync_tls_cert() {
	DOMAIN=$(cat "$DOMAIN_FILE" 2>/dev/null || true)
	[ -z "$DOMAIN" ] && return 0

	src_dir="/certs/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$DOMAIN"
	src_crt="$src_dir/$DOMAIN.crt"
	src_key="$src_dir/$DOMAIN.key"
	dest_dir=/mosquitto/data/tls
	dest_crt="$dest_dir/cert.pem"
	dest_key="$dest_dir/key.pem"
	listener_conf=/mosquitto/conf.d/tls.conf

	if [ ! -f "$src_crt" ] || [ ! -f "$src_key" ]; then
		return 0
	fi

	if [ -f "$dest_crt" ] && cmp -s "$src_crt" "$dest_crt"; then
		return 0
	fi

	mkdir -p "$dest_dir"
	cp "$src_crt" "$dest_crt"
	cp "$src_key" "$dest_key"

	cat > "$listener_conf" <<-EOF
	listener 8883
	certfile $dest_crt
	keyfile $dest_key
	EOF

	echo "TLS certificate for $DOMAIN synced — listener 8883 active"

	mosq_pid=$(pgrep -x mosquitto || true)
	if [ -n "$mosq_pid" ]; then
		kill -HUP "$mosq_pid"
		echo "sent SIGHUP to reload the TLS listener"
	fi
}

# Start the broker as the mosquitto user, in the background, so this script
# can finish setup against a live connection (granting the controller's
# command-publish rights on first boot, syncing a TLS cert) before handing
# off to it as the container's long-running process. Backgrounding the `su`
# invocation itself (not a `&` inside its -c string) keeps it a direct child
# of this script, so `wait` on it below actually works.
su mosquitto -s /bin/sh -c "$*" &
mosq_pid=$!

wait_for_broker() {
	i=0
	while [ "$i" -lt 30 ]; do
		if mosquitto_ctrl -h localhost -p 1883 -u "$DYNSEC_CONTROLLER_USERNAME" \
			-P "$DYNSEC_CONTROLLER_PASSWORD" dynsec getDefaultACLAccess >/dev/null 2>&1; then
			return 0
		fi
		i=$((i + 1))
		sleep 1
	done
	return 1
}

# --- MQTT topic & ACL spec: dedicated collector/api-command principals ----
#
# Least privilege (see the "MQTT Topic & ACL Specification" doc): the
# controller/admin account manages Dynamic Security itself ($CONTROL/*) and
# nothing else. Message collection and command publishing are separate
# accounts with only the narrow rights each job needs — neither can do the
# other's job, and neither can touch $CONTROL. Runs on every boot (not just
# FRESH_INIT), idempotently, so an existing deployment upgrading to this
# version also gets these accounts instead of only brand-new installs.
CTRL="mosquitto_ctrl -h localhost -p 1883 -u $DYNSEC_CONTROLLER_USERNAME -P $DYNSEC_CONTROLLER_PASSWORD"

role_exists() {
	# mosquitto_ctrl always exits 0 regardless of whether the dynsec command
	# itself succeeded — confirmed against the real broker, not assumed — a
	# "not found" result is only visible in the printed "Error: ..." text,
	# never the exit code. Check output content, not $?.
	$CTRL dynsec getRole "$1" 2>&1 | grep -q "^Rolename:"
}

setup_collector_principal() {
	role_exists role-collector && return 0
	echo "creating role-collector / $MQTT_COLLECTOR_USERNAME..."
	$CTRL dynsec createRole role-collector
	for type in telemetry status event ping; do
		$CTRL dynsec addRoleACL role-collector subscribePattern "devices/+/$type" allow
		$CTRL dynsec addRoleACL role-collector publishClientReceive "devices/+/$type" allow
	done
	$CTRL dynsec createClient "$MQTT_COLLECTOR_USERNAME" -p "$MQTT_COLLECTOR_PASSWORD"
	$CTRL dynsec addClientRole "$MQTT_COLLECTOR_USERNAME" role-collector
}

setup_api_command_principal() {
	role_exists role-api-command && return 0
	echo "creating role-api-command / $MQTT_API_COMMAND_USERNAME..."
	$CTRL dynsec createRole role-api-command
	$CTRL dynsec addRoleACL role-api-command publishClientSend "devices/+/cmd" allow
	$CTRL dynsec createClient "$MQTT_API_COMMAND_USERNAME" -p "$MQTT_API_COMMAND_PASSWORD"
	$CTRL dynsec addClientRole "$MQTT_API_COMMAND_USERNAME" role-api-command
}

if wait_for_broker; then
	setup_collector_principal
	setup_api_command_principal
	# Upgrade path: earlier versions granted the shared admin/controller
	# account blanket devices/# publish rights so it could double as the
	# command-publisher. That's now role-api-command's job instead — drop
	# the old grant if present (no-op, ignored, on a fresh install or an
	# already-upgraded one where it's already gone).
	$CTRL dynsec removeRoleACL admin publishClientSend "devices/#" 2>/dev/null || true
else
	echo "WARNING: broker didn't come up in time — service principals not set up" >&2
fi

sync_tls_cert

# Caddy renews the certificate automatically, and the domain itself can
# change anytime from the dashboard — mosquitto has no way to be notified
# of either on its own, so re-check periodically. 30s is cheap (just a
# stat+cmp) and is now the real "how fast does 8883 pick up a new domain"
# knob.
(
	while true; do
		sleep 30
		sync_tls_cert
	done
) &

wait "$mosq_pid"
