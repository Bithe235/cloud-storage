package main

import (
	"log"
	"strings"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/handlers"
	"pentaract-bridge/internal/middleware"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	db.InitDB(cfg.DatabaseURL)

	log.Println("Running AutoMigrate...")
	err := db.DB.AutoMigrate(
		&models.User{},
		&models.Bucket{},
		&models.File{},
		&models.ApiKey{},
		&models.Notification{},
	)
	if err != nil {
		log.Fatalf("Failed to auto migrate: %v", err)
	}
	log.Println("AutoMigrate completed.")

	r := gin.Default()

	// CORS config
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		method := c.Request.Method

		// Determine if we should allow this origin
		allowOrigin := ""

		// Detailed check for allowed origins
		isAllowed := origin == cfg.NextClientURL ||
			origin == cfg.AdminClientURL ||
			origin == "https://cloud-storage-lime.vercel.app" ||
			origin == "https://server.fahadakash.com" ||
			strings.HasSuffix(origin, ".vercel.app") ||
			strings.Contains(origin, "fahadakash.com") ||
			strings.HasPrefix(origin, "http://localhost") ||
			strings.HasPrefix(origin, "http://127.0.0.1")

		if isAllowed {
			allowOrigin = origin
		} else if origin == "" {
			allowOrigin = "*" // Fallback for non-browser requests
		}

		if allowOrigin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowOrigin)
			// Credentials must NOT be true if origin is "*"
			if allowOrigin != "*" {
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-API-Key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Disposition, Content-Type")

		// Handle Preflight
		if method == "OPTIONS" {
			if allowOrigin == "" {
				// Be permissive for preflight to at least let the request through
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			}
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	api := r.Group("/api")
	api.Use(middleware.RateLimitGuard())
	{
		api.POST("/auth/register", handlers.Register)
		api.POST("/auth/login", handlers.Login)

		protected := api.Group("")
		protected.Use(middleware.AuthGuard(), middleware.ExpiryGuard(), middleware.MaintenanceGuard())
		{
			protected.GET("/auth/me", handlers.GetMe)

			// Buckets
			protected.GET("/buckets", middleware.CheckPermission("read"), handlers.ListBuckets)
			protected.POST("/buckets", middleware.CheckPermission("write"), handlers.CreateBucket)
			protected.GET("/buckets/:id", middleware.CheckPermission("read"), handlers.GetBucket)
			protected.DELETE("/buckets/:id", middleware.CheckPermission("delete"), handlers.DeleteBucket)

			// Files (Proxy to Rust)
			protected.GET("/buckets/:id/files", middleware.CheckPermission("read"), handlers.ListFiles)
			protected.POST("/buckets/:id/files", middleware.CheckPermission("write"), handlers.UploadFile)
			protected.DELETE("/buckets/:id/files", middleware.CheckPermission("delete"), handlers.DeleteFile)
			protected.GET("/buckets/:id/download", middleware.CheckPermission("read"), handlers.DownloadFile)

			// API Keys
			protected.GET("/api-keys", handlers.ListApiKeys)
			protected.POST("/api-keys", handlers.CreateApiKey)
			protected.DELETE("/api-keys/:id", handlers.RevokeApiKey)

			// Billing
			protected.GET("/billing", handlers.GetBillingInfo)
			protected.POST("/billing/upgrade", handlers.UpgradePlan)

			// Notifications
			protected.GET("/notifications", handlers.GetNotifications)
			protected.PATCH("/notifications/:id/read", handlers.MarkNotificationRead)

			// Admin Group
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminGuard())
			{
				admin.GET("/users", handlers.AdminListUsers)
				admin.PATCH("/users/:id", handlers.AdminUpdateUserStatus)
				admin.GET("/users/:id/buckets", handlers.AdminGetUserBuckets)

				// Admin Notifications
				admin.POST("/notifications", handlers.AdminCreateNotification)
				admin.GET("/notifications", handlers.AdminListNotifications)

				// Admin Maintenance
				admin.GET("/maintenance", handlers.AdminGetMaintenanceStatus)
				admin.POST("/maintenance", handlers.AdminToggleMaintenance)
			}
		}
	}

	log.Printf("Server starting on port %s...\n", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server exit: %v", err)
	}
}
