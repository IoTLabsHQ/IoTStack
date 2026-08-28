// Package dockerstats talks to the local Docker Engine API over its unix
// socket to read per-container CPU/memory usage — plain net/http, no
// official Docker client SDK (which pulls in most of Moby for what's
// really two REST calls).
package dockerstats

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

// Client talks to the Docker Engine API over a unix socket.
type Client struct {
	httpClient *http.Client
}

// NewClient returns a Client dialing the Docker daemon at socketPath
// (typically /var/run/docker.sock).
func NewClient(socketPath string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					d := net.Dialer{}
					return d.DialContext(ctx, "unix", socketPath)
				},
			},
		},
	}
}

type containerListEntry struct {
	ID    string   `json:"Id"`
	Names []string `json:"Names"`
}

// ContainerRef identifies one running container by id and name.
type ContainerRef struct {
	ID   string
	Name string
}

// ListContainersByPrefix returns running containers whose name starts with
// prefix (Docker's own /containers/json response prefixes names with "/").
func (c *Client) ListContainersByPrefix(ctx context.Context, prefix string) ([]ContainerRef, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://docker/containers/json", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dockerstats: list containers: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dockerstats: list containers: status %d", res.StatusCode)
	}

	var entries []containerListEntry
	if err := json.NewDecoder(res.Body).Decode(&entries); err != nil {
		return nil, fmt.Errorf("dockerstats: decode container list: %w", err)
	}

	var refs []ContainerRef
	for _, e := range entries {
		for _, n := range e.Names {
			name := strings.TrimPrefix(n, "/")
			if strings.HasPrefix(name, prefix) {
				refs = append(refs, ContainerRef{ID: e.ID, Name: name})
				break
			}
		}
	}
	return refs, nil
}

// statsResponse is the subset of Docker's /containers/{id}/stats?stream=false
// response this package needs.
type statsResponse struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     uint64 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
}

// ContainerStats is the usage this agent reports for one container.
type ContainerStats struct {
	Name          string
	CPUPercent    float64
	MemUsedBytes  uint64
	MemLimitBytes uint64
}

// Stats fetches a single non-streaming stats sample for one container.
// Docker's stream=false response already includes both cpu_stats and
// precpu_stats from its own internal two-sample window, so CPU% is
// computable from one HTTP call — no history needs to be kept here.
func (c *Client) Stats(ctx context.Context, ref ContainerRef) (ContainerStats, error) {
	url := fmt.Sprintf("http://docker/containers/%s/stats?stream=false", ref.ID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ContainerStats{}, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return ContainerStats{}, fmt.Errorf("dockerstats: stats %s: %w", ref.Name, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return ContainerStats{}, fmt.Errorf("dockerstats: stats %s: status %d", ref.Name, res.StatusCode)
	}

	var s statsResponse
	if err := json.NewDecoder(res.Body).Decode(&s); err != nil {
		return ContainerStats{}, fmt.Errorf("dockerstats: decode stats %s: %w", ref.Name, err)
	}

	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage) - float64(s.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(s.CPUStats.SystemCPUUsage) - float64(s.PreCPUStats.SystemCPUUsage)
	var cpuPct float64
	if systemDelta > 0 && cpuDelta >= 0 {
		onlineCPUs := s.CPUStats.OnlineCPUs
		if onlineCPUs == 0 {
			onlineCPUs = 1
		}
		cpuPct = (cpuDelta / systemDelta) * float64(onlineCPUs) * 100
	}

	// Exclude page cache from "used" memory — matches `docker stats`'
	// own convention, otherwise idle containers look artificially full.
	memUsed := s.MemoryStats.Usage
	if s.MemoryStats.Stats.Cache < memUsed {
		memUsed -= s.MemoryStats.Stats.Cache
	}

	return ContainerStats{
		Name:          ref.Name,
		CPUPercent:    cpuPct,
		MemUsedBytes:  memUsed,
		MemLimitBytes: s.MemoryStats.Limit,
	}, nil
}
