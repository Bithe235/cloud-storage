package handlers

import (
	"log"
	"net/http"
	"time"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type RegisterReq struct {
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func generateToken(user *models.User) (string, error) {
	cfg := config.LoadConfig()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"exp":   time.Now().Add(time.Hour * 168).Unix(), // 7 days
	})
	return token.SignedString([]byte(cfg.JWTSecret))
}

func Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	// Check if exists
	var existing models.User
	if err := db.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}

	user := models.User{
		Email:         req.Email,
		Password:      string(hash),
		Role:          "user",
		IsBanned:      false,
		PlanID:        "plan_free",
		PlanExpiresAt: time.Now().AddDate(0, 1, 0), // 1 month from now
	}

	if err := db.DB.Create(&user).Error; err != nil {
		log.Println("DB error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Send Welcome Notification
	welcomeMsg := models.Notification{
		UserId:  &user.ID,
		Message: "Welcome to Pentaract! We are excited to have you on board.",
		Type:    "info",
	}
	db.DB.Create(&welcomeMsg)

	token, _ := generateToken(&user)
	c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
}

func Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if user.IsBanned {
		c.JSON(http.StatusForbidden, gin.H{
			"error":  "Your account is restricted",
			"reason": user.BanReason,
		})
		return
	}

	token, _ := generateToken(&user)

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

func GetMe(c *gin.Context) {
	userId := c.MustGet("userId").(string)

	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Password = ""
	c.JSON(http.StatusOK, user)
}
