package middleware

import (
	"net/http"

	"pentaract-bridge/internal/handlers"

	"github.com/gin-gonic/gin"
)

func MaintenanceGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		if handlers.IsMaintenanceMode {
			// Allow administrators to bypass maintenance mode
			role, _ := c.Get("userRole")
			if role == "admin" {
				c.Next()
				return
			}

			// Allow health checks to pass
			if c.Request.URL.Path == "/health" {
				c.Next()
				return
			}

			// Block everything else for users
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error":  "System Under Maintenance",
				"reason": handlers.MaintenanceReason,
				"retry":  true,
			})
			return
		}
		c.Next()
	}
}
