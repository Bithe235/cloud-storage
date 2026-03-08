package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		apiKeyHeader := c.GetHeader("X-API-Key")
		var tokenString string

		// 1. Check API Key first
		if apiKeyHeader != "" {
			hash := sha256.Sum256([]byte(apiKeyHeader))
			hashStr := hex.EncodeToString(hash[:])

			var apiKey models.ApiKey
			if err := db.DB.Where("key_hash = ?", hashStr).First(&apiKey).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid API Key"})
				return
			}

			// Update last used
			now := time.Now()
			db.DB.Model(&apiKey).Update("last_used", &now)

			c.Set("userId", apiKey.UserId)
			c.Set("permissions", apiKey.Permissions)
			c.Next()
			return
		}

		// 2. Fallback to JWT
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		} else {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		cfg := config.LoadConfig()

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("userId", claims["sub"])
			c.Set("permissions", "admin") // JWT users have full access
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		c.Next()
	}
}
func CheckPermission(requiredPerm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		perms, exists := c.Get("permissions")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden: No permissions found"})
			return
		}

		permStr := perms.(string)
		if permStr == "admin" {
			c.Next()
			return
		}

		// Split and check
		parts := strings.Split(permStr, ",")
		hasPerm := false
		for _, p := range parts {
			if strings.TrimSpace(p) == requiredPerm {
				hasPerm = true
				break
			}
		}

		if !hasPerm {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Forbidden: Missing %s permission", requiredPerm)})
			return
		}

		c.Next()
	}
}

func ExpiryGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId, exists := c.Get("userId")
		if !exists {
			c.Next()
			return
		}

		// Skip check for admin/JWT for now if needed, but user says 'all restrict'
		// Let's check for all storage related actions.

		var user models.User
		if err := db.DB.Select("plan_expires_at").Where("id = ?", userId).First(&user).Error; err != nil {
			c.Next()
			return
		}

		if !user.PlanExpiresAt.IsZero() && user.PlanExpiresAt.Before(time.Now()) {
			// Allow billing and profile info, but block storage actions
			path := c.Request.URL.Path
			if strings.Contains(path, "/buckets") || strings.Contains(path, "/files") || strings.Contains(path, "/api-keys") {
				c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
					"error":   "Subscription expired. Please renew your plan to continue using storage services.",
					"expired": true,
				})
				return
			}
		}

		c.Next()
	}
}
