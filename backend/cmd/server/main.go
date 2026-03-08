package main

import (
	"log"

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
	)
	if err != nil {
		log.Fatalf("Failed to auto migrate: %v", err)
	}
	log.Println("AutoMigrate completed.")

	r := gin.Default()

	// CORS config (Allow Next.js frontend to communicate)
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", cfg.NextClientURL)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
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
	{
		api.POST("/auth/register", handlers.Register)
		api.POST("/auth/login", handlers.Login)

		protected := api.Group("")
		protected.Use(middleware.AuthGuard())
		{
			// Buckets
			protected.GET("/buckets", handlers.ListBuckets)
			protected.POST("/buckets", handlers.CreateBucket)
			protected.GET("/buckets/:id", handlers.GetBucket)
			protected.DELETE("/buckets/:id", handlers.DeleteBucket)

			// Files (Proxy to Rust)
			protected.GET("/buckets/:id/files", handlers.ListFiles)
			protected.POST("/buckets/:id/files", handlers.UploadFile)
			protected.DELETE("/buckets/:id/files", handlers.DeleteFile)
			protected.GET("/buckets/:id/download", handlers.DownloadFile)

			// API Keys
			protected.GET("/api-keys", handlers.ListApiKeys)
			protected.POST("/api-keys", handlers.CreateApiKey)
			protected.DELETE("/api-keys/:id", handlers.RevokeApiKey)
		}
	}

	log.Printf("Server starting on port %s...\n", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server exit: %v", err)
	}
}
