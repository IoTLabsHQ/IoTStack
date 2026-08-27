// Command iotstack-agent is a small host-side daemon that reports VPS
// resource usage (CPU/RAM/disk, plus per-container usage for the
// iotstack-* containers) over a unix socket. It runs directly on the VPS
// host, outside Docker, as a systemd service — the `api` container has no
// host-level visibility on its own (no docker.sock, no /proc/sys mounts),
// so this agent is the one thing that does, and it exposes just enough of
// that over a narrow, read-only-in-effect socket.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IoTLabsHQ/IoTStack/agent/internal/snapshot"
)

func main() {
	socketPath := flag.String("socket", envOr("IOTSTACK_AGENT_SOCKET", "/run/iotstack-agent/agent.sock"), "unix socket to listen on")
	dockerSocket := flag.String("docker-socket", envOr("IOTSTACK_AGENT_DOCKER_SOCKET", "/var/run/docker.sock"), "docker daemon unix socket")
	diskMounts := flag.String("disk-mounts", envOr("IOTSTACK_AGENT_DISK_MOUNTS", "/"), "comma-separated mount points to report disk usage for")
	interval := flag.Duration("interval", envDurationOr("IOTSTACK_AGENT_INTERVAL", 2*time.Second), "sampling interval")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cache := snapshot.New(*diskMounts, *dockerSocket)
	go cache.Start(ctx, *interval)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(cache.Current()); err != nil {
			log.Printf("agent: encode stats: %v", err)
		}
	})

	if err := os.Remove(*socketPath); err != nil && !os.IsNotExist(err) {
		log.Fatalf("agent: remove stale socket: %v", err)
	}
	listener, err := net.Listen("unix", *socketPath)
	if err != nil {
		log.Fatalf("agent: listen on %s: %v", *socketPath, err)
	}
	// World-connectable: the socket only ever serves read-only, non-secret
	// stats (no credentials, no control operations) and is unreachable
	// outside this host's filesystem namespace — see docs/reference/002_security.
	if err := os.Chmod(*socketPath, 0o666); err != nil {
		log.Fatalf("agent: chmod socket: %v", err)
	}

	server := &http.Server{Handler: mux}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	log.Printf("iotstack-agent listening on %s (interval=%s)", *socketPath, *interval)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("agent: serve: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDurationOr(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
