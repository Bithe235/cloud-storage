package handlers

import (
	"net/http"

	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

func GetNotifications(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var notifications []models.Notification
	// Fetch global notifications (UserId IS NULL) OR user specific notifications
	if err := db.DB.Where("user_id IS NULL OR user_id = ?", userId).Order("created_at desc").Limit(20).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, notifications)
}

func MarkNotificationRead(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	notifId := c.Param("id")

	if err := db.DB.Model(&models.Notification{}).Where("id = ? AND (user_id = ? OR user_id IS NULL)", notifId, userId).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}
