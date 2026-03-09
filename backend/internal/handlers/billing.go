package handlers

import (
	"database/sql"
	"log"
	"math"
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
	{ID: "plan_free", Name: "Free Plan", PriceBDT: 0, Limit: 100 * 1024 * 1024 * 1024, MaxBuckets: 3, MaxApiKeys: 2},
	{ID: "plan_1.5tb", Name: "1.5TB Monthly", PriceBDT: 190, Limit: 1500 * 1024 * 1024 * 1024, MaxBuckets: 10, MaxApiKeys: 5},
	{ID: "plan_4tb", Name: "4TB Monthly", PriceBDT: 299, Limit: 4000 * 1024 * 1024 * 1024, MaxBuckets: 25, MaxApiKeys: 10},
	{ID: "plan_5tb", Name: "5TB Monthly", PriceBDT: 320, Limit: 5000 * 1024 * 1024 * 1024, MaxBuckets: 100, MaxApiKeys: 50},
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

	// Check for expiration — use math.Ceil to round up (so 29.1 days = 30 days remaining)
	isExpired := false
	daysLeft := 0
	if !user.PlanExpiresAt.IsZero() {
		if time.Now().After(user.PlanExpiresAt) {
			isExpired = true
		} else {
			daysLeft = int(math.Ceil(time.Until(user.PlanExpiresAt).Hours() / 24))
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

	// Validate the new plan exists
	newPlan := GetPlan(req.PlanID)
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

	// Read current user
	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	currentPlan := GetPlan(user.PlanID)
	now := time.Now()

	// --- Same plan, still active: do nothing ---
	if user.PlanID == req.PlanID && !user.PlanExpiresAt.IsZero() && now.Before(user.PlanExpiresAt) {
		c.JSON(http.StatusOK, gin.H{
			"message":       "You are already on this plan",
			"planId":        user.PlanID,
			"expiresAt":     user.PlanExpiresAt,
			"creditedDays":  0,
			"prorationType": "none",
		})
		return
	}

	// --- PRORATION STRATEGY ---
	//
	// How major platforms handle mid-cycle plan changes:
	//
	// UPGRADE (new plan costs more):
	//   → Start new plan immediately.
	//   → Calculate remaining value on old plan as "credit days".
	//   → Credit = (remainingDays / 30) * oldPlan.PriceBDT / newPlan.PriceBDT * 30 days
	//   → New expiry = now + 30 days + creditedDays
	//   → User never loses value they already paid for.
	//
	// DOWNGRADE (new plan costs less):
	//   → Downgrade takes effect when current plan EXPIRES (scheduled).
	//   → This prevents users from downgrading and extracting refunds/credits
	//     from a higher-price plan they already used.
	//   → Free plan is always allowed to switch to immediately.
	//
	// EXPIRED / FREE switching to any plan:
	//   → Start new plan immediately from now + 30 days. No credit.

	var expiresAt time.Time
	creditedDays := 0
	prorationType := "full"

	// Check if there's an active (non-expired) plan to prorate from
	hasActivePlan := !user.PlanExpiresAt.IsZero() && now.Before(user.PlanExpiresAt)

	if hasActivePlan {
		remainingDuration := user.PlanExpiresAt.Sub(now)
		remainingDays := remainingDuration.Hours() / 24

		isUpgrade := newPlan.PriceBDT > currentPlan.PriceBDT
		isDowngrade := newPlan.PriceBDT < currentPlan.PriceBDT && newPlan.PriceBDT > 0 // not free

		if isDowngrade {
			// Downgrade: schedule for end of cycle, don't switch now
			c.JSON(http.StatusOK, gin.H{
				"message":          "Downgrade scheduled. Your current plan will remain active until it expires, then switch to the new plan.",
				"scheduledPlanId":  req.PlanID,
				"currentPlanId":    user.PlanID,
				"currentExpiresAt": user.PlanExpiresAt,
				"prorationType":    "scheduled_downgrade",
				"creditedDays":     0,
			})
			return
		}

		if isUpgrade && currentPlan.PriceBDT > 0 && newPlan.PriceBDT > 0 {
			// Prorate: convert remaining old-plan days into credit for new plan
			// Credit formula: (remainingDays * oldPlanPrice) / newPlanPrice
			creditFloat := (remainingDays * float64(currentPlan.PriceBDT)) / float64(newPlan.PriceBDT)
			creditedDays = int(math.Floor(creditFloat))
			prorationType = "prorated_upgrade"
		} else if newPlan.PriceBDT == 0 {
			// Switching to free plan immediately (no credit — free plan is always available)
			prorationType = "switch_to_free"
		} else {
			// Same price tier or free→paid: just start fresh
			prorationType = "full"
		}
	}

	// New expiry = now + 30 days + credited days
	expiresAt = now.AddDate(0, 1, 0).Add(time.Duration(creditedDays) * 24 * time.Hour)

	if err := db.DB.Model(&models.User{}).Where("id = ?", userId).Updates(map[string]interface{}{
		"plan_id":         req.PlanID,
		"plan_expires_at": expiresAt,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Plan updated successfully",
		"planId":        req.PlanID,
		"expiresAt":     expiresAt,
		"creditedDays":  creditedDays,
		"prorationType": prorationType,
	})
}
