package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

type Plan struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	PriceBDT   int    `json:"priceBDT"`
	Limit      int64  `json:"limit"` // in bytes
	MaxBuckets int    `json:"maxBuckets"`
	MaxApiKeys int    `json:"maxApiKeys"`
}

var BillingPlans = []Plan{
	{ID: "plan_free", Name: "Free Plan", PriceBDT: 0, Limit: 50 * 1024 * 1024 * 1024, MaxBuckets: 3, MaxApiKeys: 2},
	{ID: "plan_100gb", Name: "100GB Monthly", PriceBDT: 190, Limit: 100 * 1024 * 1024 * 1024, MaxBuckets: 10, MaxApiKeys: 5},
	{ID: "plan_300gb", Name: "300GB Monthly", PriceBDT: 399, Limit: 300 * 1024 * 1024 * 1024, MaxBuckets: 25, MaxApiKeys: 10},
	{ID: "plan_1tb", Name: "1TB Monthly", PriceBDT: 440, Limit: 1000 * 1024 * 1024 * 1024, MaxBuckets: 100, MaxApiKeys: 50},
}

func GetPlan(planID string) Plan {
	for _, p := range BillingPlans {
		if p.ID == planID {
			return p
		}
	}
	return BillingPlans[0] // Default to Free
}

func GetPlanLimit(planID string) int64 {
	return GetPlan(planID).Limit
}

func GetBucketLimit(planID string) int {
	return GetPlan(planID).MaxBuckets
}

func GetApiKeyLimit(planID string) int {
	return GetPlan(planID).MaxApiKeys
}

func GetUsedStorage(userID string) int64 {
	var usedStorage sql.NullInt64

	// Query sum of files sizes from Rust's "files" table for all buckets owned by the user.
	err := db.DB.Table("files").
		Joins("JOIN cc_buckets ON files.storage_id = cc_buckets.pentaract_id").
		Where("cc_buckets.owner_id = ? AND files.is_uploaded = true", userID).
		Select("SUM(files.size)").Scan(&usedStorage).Error

	if err != nil {
		log.Printf("Error calculating used storage: %v", err)
		return 0
	}
	if !usedStorage.Valid {
		return 0
	}
	return usedStorage.Int64
}

func GetBillingInfo(c *gin.Context) {
	userIdValue, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context missing"})
		return
	}
	userId := userIdValue.(string)

	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User find error"})
		return
	}

	used := GetUsedStorage(userId)
	plan := GetPlan(user.PlanID)

	// Counts
	var bucketsCount int64
	db.DB.Model(&models.Bucket{}).Where("owner_id = ?", userId).Count(&bucketsCount)

	var apiKeysCount int64
	db.DB.Model(&models.ApiKey{}).Where("user_id = ?", userId).Count(&apiKeysCount)

	// Check for expiration
	isExpired := false
	daysLeft := 0
	if !user.PlanExpiresAt.IsZero() {
		if time.Now().After(user.PlanExpiresAt) {
			isExpired = true
		} else {
			daysLeft = int(time.Until(user.PlanExpiresAt).Hours() / 24)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"planId":       user.PlanID,
		"limit":        plan.Limit,
		"used":         used,
		"maxBuckets":   plan.MaxBuckets,
		"bucketsCount": bucketsCount,
		"maxApiKeys":   plan.MaxApiKeys,
		"apiKeysCount": apiKeysCount,
		"plans":        BillingPlans,
		"expiresAt":    user.PlanExpiresAt,
		"isExpired":    isExpired,
		"daysLeft":     daysLeft,
	})
}

func UpgradePlan(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var req struct {
		PlanID string `json:"planId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	validPlan := false
	for _, p := range BillingPlans {
		if p.ID == req.PlanID {
			validPlan = true
			break
		}
	}

	if !validPlan {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan ID"})
		return
	}

	// Update plan and extend expiration by 1 month
	expiresAt := time.Now().AddDate(0, 1, 0)

	if err := db.DB.Model(&models.User{}).Where("id = ?", userId).Updates(map[string]interface{}{
		"plan_id":         req.PlanID,
		"plan_expires_at": expiresAt,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Plan updated successfully",
		"planId":    req.PlanID,
		"expiresAt": expiresAt,
	})
}
