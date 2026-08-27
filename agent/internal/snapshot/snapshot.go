// Package snapshot keeps a periodically-refreshed cache of host + container
// stats, so HTTP requests to the agent never block on a live read (and
// host CPU%, which needs two samples over time, always has one ready).
package snapshot

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/IoTLabsHQ/IoTStack/agent/internal/dockerstats"
	"github.com/IoTLabsHQ/IoTStack/agent/internal/hoststats"
)

const containerNamePrefix = "iotstack-"

// Disk is one filesystem's usage.
type Disk struct {
	Mount      string `json:"mount"`
	UsedBytes  uint64 `json:"usedBytes"`
	TotalBytes uint64 `json:"totalBytes"`
}

// Host is host-wide resource usage.
type Host struct {
	CPUPercent    float64 `json:"cpuPct"`
	Load1         float64 `json:"load1"`
	MemUsedBytes  uint64  `json:"memUsedBytes"`
	MemTotalBytes uint64  `json:"memTotalBytes"`
	Disks         []Disk  `json:"disks"`
}

// Container is one iotstack-* container's usage.
type Container struct {
	Name          string  `json:"name"`
	CPUPercent    float64 `json:"cpuPct"`
	MemUsedBytes  uint64  `json:"memUsedBytes"`
	MemLimitBytes uint64  `json:"memLimitBytes"`
}

// Stats is the full snapshot served at GET /v1/stats.
type Stats struct {
	Timestamp  time.Time   `json:"ts"`
	Host       Host        `json:"host"`
	Containers []Container `json:"containers"`
}

// Cache holds the latest Stats, safe for concurrent reads while the
// background ticker refreshes it.
type Cache struct {
	mu   sync.RWMutex
	last Stats

	diskMounts string // comma-separated, e.g. "/"
	docker     *dockerstats.Client
	prevCPU    hoststats.CPUSample
	havePrev   bool
}

// New returns a Cache that will sample the given disk mounts
// (comma-separated paths) and talk to Docker at dockerSocketPath.
func New(diskMounts, dockerSocketPath string) *Cache {
	return &Cache{
		diskMounts: diskMounts,
		docker:     dockerstats.NewClient(dockerSocketPath),
	}
}

// Current returns the most recently sampled Stats. Zero value until the
// first tick completes.
func (c *Cache) Current() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.last
}

// Start runs the sampling loop until ctx is done. Blocks — call in a
// goroutine.
func (c *Cache) Start(ctx context.Context, interval time.Duration) {
	c.tick(ctx)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.tick(ctx)
		}
	}
}

func (c *Cache) tick(ctx context.Context) {
	stats := Stats{Timestamp: time.Now().UTC()}

	if cpu, err := hoststats.ReadCPUSample(); err != nil {
		log.Printf("snapshot: read cpu: %v", err)
	} else {
		if c.havePrev {
			stats.Host.CPUPercent = hoststats.CPUPercent(c.prevCPU, cpu)
		}
		c.prevCPU = cpu
		c.havePrev = true
	}

	if load1, err := hoststats.ReadLoad1(); err != nil {
		log.Printf("snapshot: read load1: %v", err)
	} else {
		stats.Host.Load1 = load1
	}

	if mem, err := hoststats.ReadMemStat(); err != nil {
		log.Printf("snapshot: read mem: %v", err)
	} else {
		stats.Host.MemUsedBytes = mem.UsedBytes
		stats.Host.MemTotalBytes = mem.TotalBytes
	}

	for _, mount := range splitNonEmpty(c.diskMounts, ',') {
		disk, err := hoststats.ReadDiskStat(mount)
		if err != nil {
			log.Printf("snapshot: read disk %s: %v", mount, err)
			continue
		}
		stats.Host.Disks = append(stats.Host.Disks, Disk{
			Mount:      disk.Mount,
			UsedBytes:  disk.UsedBytes,
			TotalBytes: disk.TotalBytes,
		})
	}

	refs, err := c.docker.ListContainersByPrefix(ctx, containerNamePrefix)
	if err != nil {
		log.Printf("snapshot: list containers: %v", err)
	} else {
		for _, ref := range refs {
			cs, err := c.docker.Stats(ctx, ref)
			if err != nil {
				log.Printf("snapshot: container stats %s: %v", ref.Name, err)
				continue
			}
			stats.Containers = append(stats.Containers, Container{
				Name:          cs.Name,
				CPUPercent:    cs.CPUPercent,
				MemUsedBytes:  cs.MemUsedBytes,
				MemLimitBytes: cs.MemLimitBytes,
			})
		}
	}

	c.mu.Lock()
	c.last = stats
	c.mu.Unlock()
}

func splitNonEmpty(s string, sep rune) []string {
	var out []string
	start := 0
	for i, r := range s {
		if r == sep {
			if v := s[start:i]; v != "" {
				out = append(out, v)
			}
			start = i + 1
		}
	}
	if v := s[start:]; v != "" {
		out = append(out, v)
	}
	return out
}
