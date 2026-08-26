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
# This only takes effect once DOMAIN is set and Caddy has actually finished
# an ACME issuance — until then mosquitto just runs without 8883, no error.
sync_tls_cert() {
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

if [ "$FRESH_INIT" = "1" ]; then
	if wait_for_broker; then
		echo "granting controller account command-publish rights..."
		mosquitto_ctrl -h localhost -p 1883 -u "$DYNSEC_CONTROLLER_USERNAME" \
			-P "$DYNSEC_CONTROLLER_PASSWORD" \
			dynsec addRoleACL admin publishClientSend "devices/#" allow
	else
		echo "WARNING: broker didn't come up in time — controller command-publish rights not granted" >&2
	fi
fi

sync_tls_cert

# Caddy renews the certificate automatically, but mosquitto has no way to
# notice on its own — re-check periodically for a renewed (changed) cert
# and reload when one shows up.
(
	while true; do
		sleep 21600 # 6h
		sync_tls_cert
	done
) &

wait "$mosq_pid"
