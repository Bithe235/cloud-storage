package handlers

import (
	"log"
	"net/http"
	"regexp"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"
	"pentaract-bridge/internal/services"

	"github.com/gin-gonic/gin"
)

type CreateBucketReq struct {
	Name   string `json:"name" binding:"required,min=3"`
	Region string `json:"region"`
}

type BucketRes struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Region     string `json:"region"`
	CreatedAt  string `json:"createdAt"`
	FilesCount int    `json:"filesCount"`
	TotalSize  int64  `json:"totalSize"`
}

func ListBuckets(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var buckets []models.Bucket
	// GORM preloading is powerful but let's just fetch buckets without counting files for immediate response
	// The client handles this gracefully
	err := db.DB.Where("owner_id = ?", userId).Order("created_at desc").Find(&buckets).Error
	if err != nil {
		log.Println("ListBuckets DB Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch buckets"})
		return
	}

	var res []BucketRes
	for _, b := range buckets {
		res = append(res, BucketRes{
			ID:         b.ID,
			Name:       b.Name,
			Region:     "us-east-1", // default since not stored locally
			CreatedAt:  b.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			FilesCount: 0,
			TotalSize:  0,
		})
	}

	if res == nil {
		res = []BucketRes{}
	}
	c.JSON(http.StatusOK, res)
}

func GetBucket(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	res := BucketRes{
		ID:         bucket.ID,
		Name:       bucket.Name,
		Region:     "us-east-1",
		CreatedAt:  bucket.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		FilesCount: 0,
		TotalSize:  0,
	}

	c.JSON(http.StatusOK, res)
}

func CreateBucket(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var req CreateBucketReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	if match, _ := regexp.MatchString("^[a-z0-9][a-z0-9-]*[a-z0-9]$", req.Name); !match {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bucket name must be lowercase alphanumeric with hyphens only"})
		return
	}

	region := req.Region
	if region == "" {
		region = "us-east-1"
	}

	cfg := config.LoadConfig()

	// Use user ID prefix for Rust storage name to ensure global uniqueness for the master account
	rustStorageName := userId + "-" + req.Name
	pentaractId, err := services.CreatePentaractStorage(rustStorageName, cfg.TelegramChatID)
	if err != nil {
		log.Println("Pentaract Storage Create Error:", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to provision underlying storage engine"})
		return
	}

	// Option A: Centralized Telegram Worker Registration
	if cfg.TelegramBotToken != "" {
		if err := services.RegisterStorageWorker(pentaractId, cfg.TelegramBotToken); err != nil {
			log.Println("Pentaract Storage Worker Registration Error:", err)
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to link Telegram Storage Worker"})
			return
		}
	}

	bucket := models.Bucket{
		Name:        req.Name,
		OwnerId:     userId,
		PentaractID: pentaractId,
	}

	if err := db.DB.Create(&bucket).Error; err != nil {
		log.Println("Go DB Bucket Create Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bucket link"})
		return
	}

	c.JSON(http.StatusCreated, bucket)
}

func DeleteBucket(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	cfg := config.LoadConfig()
	url := cfg.PentaractURL + "/storages/" + bucket.PentaractID

	req, _ := http.NewRequest("DELETE", url, nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		log.Println("Pentaract Storage Delete Error:", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach storage engine to delete bucket"})
		return
	}
	defer resp.Body.Close()

	if result := db.DB.Delete(&bucket); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bucket locally"})
		return
	}

	c.Status(http.StatusNoContent)
}
