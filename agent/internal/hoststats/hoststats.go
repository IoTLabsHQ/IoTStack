// Package hoststats reads host-level CPU, memory, and disk usage directly
// from /proc and syscall.Statfs — no external dependencies, since this
// agent runs as a static binary on the VPS host itself, outside Docker.
package hoststats

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
)

// CPUSample is a raw jiffie counter snapshot from /proc/stat's "cpu" line.
// CPU percent requires two samples — see CPUPercent.
type CPUSample struct {
	Total uint64
	Idle  uint64
}

// ReadCPUSample reads the first "cpu " summary line of /proc/stat.
func ReadCPUSample() (CPUSample, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return CPUSample{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return CPUSample{}, fmt.Errorf("hoststats: empty /proc/stat")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return CPUSample{}, fmt.Errorf("hoststats: unexpected /proc/stat format: %q", scanner.Text())
	}

	var total uint64
	var idle uint64
	for i, f := range fields[1:] {
		v, err := strconv.ParseUint(f, 10, 64)
		if err != nil {
			continue
		}
		total += v
		// Fields, in order: user, nice, system, idle, iowait, irq, softirq, steal.
		// idle (index 3) and iowait (index 4) both count as "not busy".
		if i == 3 || i == 4 {
			idle += v
		}
	}
	return CPUSample{Total: total, Idle: idle}, nil
}

// CPUPercent computes busy% between two samples taken some interval apart.
func CPUPercent(prev, curr CPUSample) float64 {
	totalDelta := curr.Total - prev.Total
	idleDelta := curr.Idle - prev.Idle
	if totalDelta == 0 {
		return 0
	}
	busy := float64(totalDelta-idleDelta) / float64(totalDelta)
	return busy * 100
}

// MemStat is host memory usage in bytes.
type MemStat struct {
	UsedBytes  uint64
	TotalBytes uint64
}

// ReadMemStat parses /proc/meminfo. "Used" is derived as MemTotal minus
// MemAvailable (the kernel's own best estimate of memory usable without
// swapping — more accurate than MemTotal-MemFree, which ignores reclaimable
// cache/buffers and would overstate real usage).
func ReadMemStat() (MemStat, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return MemStat{}, err
	}
	defer f.Close()

	var totalKB, availKB uint64
	found := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() && found < 2 {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "MemTotal:"):
			totalKB = parseMeminfoValue(line)
			found++
		case strings.HasPrefix(line, "MemAvailable:"):
			availKB = parseMeminfoValue(line)
			found++
		}
	}
	if found < 2 {
		return MemStat{}, fmt.Errorf("hoststats: MemTotal/MemAvailable not found in /proc/meminfo")
	}

	total := totalKB * 1024
	avail := availKB * 1024
	var used uint64
	if avail < total {
		used = total - avail
	}
	return MemStat{UsedBytes: used, TotalBytes: total}, nil
}

func parseMeminfoValue(line string) uint64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}
	v, _ := strconv.ParseUint(fields[1], 10, 64)
	return v
}

// DiskStat is disk usage in bytes for one mounted filesystem.
type DiskStat struct {
	Mount      string
	UsedBytes  uint64
	TotalBytes uint64
}

// ReadDiskStat reads usage for the filesystem containing mount, via
// syscall.Statfs — the same primitive `df` itself uses.
func ReadDiskStat(mount string) (DiskStat, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(mount, &st); err != nil {
		return DiskStat{}, fmt.Errorf("hoststats: statfs %s: %w", mount, err)
	}
	blockSize := uint64(st.Bsize)
	total := st.Blocks * blockSize
	free := st.Bfree * blockSize
	var used uint64
	if free < total {
		used = total - free
	}
	return DiskStat{Mount: mount, UsedBytes: used, TotalBytes: total}, nil
}

// ReadLoad1 reads the 1-minute load average from /proc/loadavg.
func ReadLoad1() (float64, error) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0, fmt.Errorf("hoststats: empty /proc/loadavg")
	}
	return strconv.ParseFloat(fields[0], 64)
}
