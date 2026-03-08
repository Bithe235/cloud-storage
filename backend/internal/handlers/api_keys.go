package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"

	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

type CreateKeyReq struct {
	Name        string `json:"name" binding:"required"`
	Permissions string `json:"permissions"` // e.g. "read,write,delete"
}

func generateKey() (string, string) {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	rawKey := "pk_" + hex.EncodeToString(bytes)

	hash := sha256.Sum256([]byte(rawKey))
	hashStr := hex.EncodeToString(hash[:])

	return rawKey, hashStr
}

func CreateApiKey(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	// Limit Check
	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User find error"})
		return
	}

	var currentCount int64
	db.DB.Model(&models.ApiKey{}).Where("user_id = ?", userId).Count(&currentCount)

	limit := GetApiKeyLimit(user.PlanID)
	if int(currentCount) >= limit {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": fmt.Sprintf("API Key limit reached (%d/%d). Please upgrade your plan.", currentCount, limit)})
		return
	}

	var req CreateKeyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	if req.Permissions == "" {
		req.Permissions = "read"
	}

	rawKey, hashStr := generateKey()
	prefix := rawKey[:12] + "..."

	apiKey := models.ApiKey{
		Name:        req.Name,
		UserId:      userId,
		KeyHash:     hashStr,
		Prefix:      prefix,
		Permissions: req.Permissions,
	}

	if err := db.DB.Create(&apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate key"})
		return
	}

	// Return the raw key ONLY once
	c.JSON(http.StatusCreated, gin.H{
		"apiKey": apiKey,
		"rawKey": rawKey,
	})
}

func ListApiKeys(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var keys []models.ApiKey
	if err := db.DB.Where("user_id = ?", userId).Order("created_at desc").Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch keys"})
		return
	}

	c.JSON(http.StatusOK, keys)
}

func RevokeApiKey(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	keyId := c.Param("id")

	result := db.DB.Where("id = ? AND user_id = ?", keyId, userId).Delete(&models.ApiKey{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke key"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Key not found"})
		return
	}

	c.Status(http.StatusNoContent)
}
