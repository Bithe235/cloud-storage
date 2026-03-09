package middleware

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter stores different limiters for Read, Write, and Delete operations
type RateLimiters struct {
	Read     *rate.Limiter
	Write    *rate.Limiter
	Delete   *rate.Limiter
	LastSeen time.Time
}

// IPRateLimiter manages the collection of per-IP rate limiters
type IPRateLimiter struct {
	ips map[string]*RateLimiters
	mu  sync.RWMutex
}

// NewIPRateLimiter creates a new IPRateLimiter instance
func NewIPRateLimiter() *IPRateLimiter {
	i := &IPRateLimiter{
		ips: make(map[string]*RateLimiters),
	}

	// Start a periodic cleanup of inactive IPs (every 10 minutes)
	go i.cleanup()

	return i
}

// GetLimiters returns the rate limiters associated with a specific IP address
func (i *IPRateLimiter) GetLimiters(ip string) *RateLimiters {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiters, exists := i.ips[ip]
	if !exists {
		// --- CONFIGURABLE LIMITS ---
		// Read:   ~60 requests per minute (1 per sec, burst 10)
		// Write:  ~20 requests per minute (~1 per 3 sec, burst 3)
		// Delete: ~5 requests per minute  (~1 per 12 sec, burst 2)

		limiters = &RateLimiters{
			Read:   rate.NewLimiter(1, 10),               // 1 token/sec, burst 10
			Write:  rate.NewLimiter(rate.Limit(0.33), 3), // ~1 token per 3 sec, burst 3
			Delete: rate.NewLimiter(rate.Limit(0.08), 2), // ~1 token per 12 sec, burst 2
		}
		i.ips[ip] = limiters
	}

	limiters.LastSeen = time.Now()
	return limiters
}

// cleanup removes rate limiters for IPs that haven't been seen for an hour
func (i *IPRateLimiter) cleanup() {
	for {
		time.Sleep(10 * time.Minute)
		i.mu.Lock()
		for ip, limiters := range i.ips {
			if time.Since(limiters.LastSeen) > time.Hour {
				delete(i.ips, ip)
			}
		}
		i.mu.Unlock()
	}
}

var globalLimiter = NewIPRateLimiter()

// RateLimitGuard implements the rate limiting middleware for Gin
func RateLimitGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiters := globalLimiter.GetLimiters(ip)

		var l *rate.Limiter
		operation := "read"
		method := c.Request.Method

		switch method {
		case http.MethodGet, http.MethodHead:
			l = limiters.Read
			operation = "read"
		case http.MethodPost, http.MethodPut, http.MethodPatch:
			l = limiters.Write
			operation = "write"
		case http.MethodDelete:
			l = limiters.Delete
			operation = "delete"
		default:
			l = limiters.Read // Default to read limit for other methods
			operation = "read"
		}

		if !l.Allow() {
			log.Printf("Rate limit EXCEEDED for IP: %s, Op: %s", ip, operation)
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":     "Too many requests",
				"message":   "You've exceeded the " + operation + " rate limit. Please wait briefly and try again.",
				"retry":     true,
				"operation": operation,
			})
			return
		}

		c.Next()
	}
}
