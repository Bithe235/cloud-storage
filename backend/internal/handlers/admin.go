package handlers

import (
	"net/http"

	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

type AdminUserRes struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	IsBanned     bool   `json:"isBanned"`
	PlanID       string `json:"planId"`
	BucketsCount int64  `json:"bucketsCount"`
	KeysCount    int64  `json:"keysCount"`
	StorageUsed  int64  `json:"storageUsed"`
	CreatedAt    string `json:"createdAt"`
}

func AdminListUsers(c *gin.Context) {
	var users []models.User
	if err := db.DB.Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	var res []AdminUserRes
	for _, u := range users {
		var bCount int64
		db.DB.Model(&models.Bucket{}).Where("owner_id = ?", u.ID).Count(&bCount)

		var kCount int64
		db.DB.Model(&models.ApiKey{}).Where("user_id = ?", u.ID).Count(&kCount)

		storageUsed := GetUsedStorage(u.ID)

		res = append(res, AdminUserRes{
			ID:           u.ID,
			Email:        u.Email,
			Role:         u.Role,
			IsBanned:     u.IsBanned,
			PlanID:       u.PlanID,
			BucketsCount: bCount,
			KeysCount:    kCount,
			StorageUsed:  storageUsed,
			CreatedAt:    u.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, res)
}

func AdminUpdateUserStatus(c *gin.Context) {
	targetUserId := c.Param("id")
	var req struct {
		IsBanned  bool   `json:"isBanned"`
		BanReason string `json:"banReason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	updates := map[string]interface{}{
		"is_banned":  req.IsBanned,
		"ban_reason": req.BanReason,
	}

	if err := db.DB.Model(&models.User{}).Where("id = ?", targetUserId).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User status updated", "isBanned": req.IsBanned, "banReason": req.BanReason})
}

func AdminGetUserBuckets(c *gin.Context) {
	targetUserId := c.Param("id")

	var buckets []models.Bucket
	if err := db.DB.Where("owner_id = ?", targetUserId).Find(&buckets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user buckets"})
		return
	}

	c.JSON(http.StatusOK, buckets)
}

func AdminCreateNotification(c *gin.Context) {
	var req struct {
		UserId  *string `json:"userId"`
		Message string  `json:"message" binding:"required"`
		Type    string  `json:"type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	notification := models.Notification{
		UserId:  req.UserId,
		Message: req.Message,
		Type:    req.Type,
	}

	if err := db.DB.Create(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create notification"})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func AdminListNotifications(c *gin.Context) {
	var notifications []models.Notification
	if err := db.DB.Order("created_at desc").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}
	c.JSON(http.StatusOK, notifications)
}
