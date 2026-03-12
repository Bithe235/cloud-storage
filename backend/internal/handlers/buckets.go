package handlers

import (
	"fmt"
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

	var res []BucketRes

	// Fetch buckets with file counts and total sizes using a join with the engine's files table
	err := db.DB.Table("cc_buckets").
		Select("cc_buckets.id, cc_buckets.name, cc_buckets.created_at, COUNT(files.id) as files_count, COALESCE(SUM(files.size), 0) as total_size").
		Joins("LEFT JOIN files ON cc_buckets.pentaract_id = files.storage_id AND files.is_uploaded = true").
		Where("cc_buckets.owner_id = ?", userId).
		Group("cc_buckets.id, cc_buckets.name, cc_buckets.created_at").
		Order("cc_buckets.created_at desc").
		Scan(&res).Error

	if err != nil {
		log.Println("ListBuckets DB Error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch buckets"})
		return
	}

	for i := range res {
		res[i].Region = "us-east-1"
	}

	if res == nil {
		res = []BucketRes{}
	}
	c.JSON(http.StatusOK, res)
}

func GetBucket(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var res BucketRes
	userRole, _ := c.Get("userRole")
	query := db.DB.Table("cc_buckets").
		Select("cc_buckets.id, cc_buckets.name, cc_buckets.created_at, COUNT(files.id) as files_count, COALESCE(SUM(files.size), 0) as total_size").
		Joins("LEFT JOIN files ON cc_buckets.pentaract_id = files.storage_id AND files.is_uploaded = true").
		Where("cc_buckets.id = ?", bucketId)

	if userRole != "admin" {
		query = query.Where("cc_buckets.owner_id = ?", userId)
	}

	err := query.Group("cc_buckets.id, cc_buckets.name, cc_buckets.created_at").Scan(&res).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	if res.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}

	res.Region = "us-east-1"
	c.JSON(http.StatusOK, res)
}

func CreateBucket(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	// Limit Check
	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User find error"})
		return
	}

	var currentCount int64
	db.DB.Model(&models.Bucket{}).Where("owner_id = ?", userId).Count(&currentCount)

	limit := GetBucketLimit(user.PlanID)
	if int(currentCount) >= limit {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": fmt.Sprintf("Bucket limit reached (%d/%d). Please upgrade your plan.", currentCount, limit)})
		return
	}

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
		region = "bangladesh"
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
	userRole, _ := c.Get("userRole")
	query := db.DB.Where("id = ?", bucketId)
	if userRole != "admin" {
		query = query.Where("owner_id = ?", userId)
	}

	if err := query.First(&bucket).Error; err != nil {
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
