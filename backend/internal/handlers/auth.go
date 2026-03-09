package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"time"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"
	"pentaract-bridge/internal/services"

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

	// Generate a 6-digit OTP
	b := make([]byte, 3) // 3 bytes = 6 hex chars
	rand.Read(b)
	otpCode := hex.EncodeToString(b)[:6]

	expr := time.Now().Add(15 * time.Minute)

	user := models.User{
		Email:                         req.Email,
		Password:                      string(hash),
		Role:                          "user",
		IsBanned:                      false,
		PlanID:                        "plan_free",
		PlanExpiresAt:                 time.Now().AddDate(0, 1, 0), // 1 month from now
		IsEmailVerified:               false,
		EmailVerificationOTP:          &otpCode,
		EmailVerificationOTPExpiresAt: &expr,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		log.Println("DB error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Send Welcome Notification
	welcomeMsg := models.Notification{
		UserId:  &user.ID,
		Message: "Welcome to Pentaract! We are excited to have you on board. Please verify your email.",
		Type:    "info",
	}
	db.DB.Create(&welcomeMsg)

	// Send OTP Email
	if err := services.SendVerificationOTPEmail(user.Email, otpCode); err != nil {
		log.Printf("Failed to send welcome OTP email: %v", err)
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Registration successful. Please verify your email.", "email": user.Email})
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

	if !user.IsEmailVerified {
		c.JSON(http.StatusForbidden, gin.H{
			"error":      "Email not verified",
			"unverified": true,
		})
		return
	}

	token, _ := generateToken(&user)

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

type VerifyEmailReq struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required"`
}

func VerifyEmail(c *gin.Context) {
	var req VerifyEmailReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or OTP"})
		return
	}

	if user.IsEmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "Email already verified"})
		return
	}

	if user.EmailVerificationOTP == nil || *user.EmailVerificationOTP != req.OTP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OTP code"})
		return
	}

	if user.EmailVerificationOTPExpiresAt == nil || user.EmailVerificationOTPExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP has expired. Please request a new one."})
		return
	}

	// Verify user
	db.DB.Model(&user).Updates(map[string]interface{}{
		"is_email_verified":                 true,
		"email_verification_otp":            nil,
		"email_verification_otp_expires_at": nil,
	})

	token, _ := generateToken(&user)
	user.Password = ""

	c.JSON(http.StatusOK, gin.H{
		"message": "Email verified successfully!",
		"user":    user,
		"token":   token,
	})
}

type ResendOTPReq struct {
	Email string `json:"email" binding:"required,email"`
}

func ResendVerificationOTP(c *gin.Context) {
	var req ResendOTPReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "If an account exists, a new OTP has been sent."})
		return
	}

	if user.IsEmailVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Account is already verified"})
		return
	}

	// Rate limit check: Don't allow resending if there's still a valid OTP created < 1 minute ago (optional, but good practice)
	// For simplicity, we just generate a new one and overwrite.
	b := make([]byte, 3)
	rand.Read(b)
	otpCode := hex.EncodeToString(b)[:6]

	expr := time.Now().Add(15 * time.Minute)

	db.DB.Model(&user).Updates(map[string]interface{}{
		"email_verification_otp":            &otpCode,
		"email_verification_otp_expires_at": &expr,
	})

	// Non-goroutine call to see errors in logs immediately
	if err := services.SendVerificationOTPEmail(user.Email, otpCode); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email. Configuration error."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "A new verification code has been sent."})
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

type ForgotPasswordReq struct {
	Email string `json:"email" binding:"required,email"`
}

func ForgotPassword(c *gin.Context) {
	var req ForgotPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Do not leak information, pretend it sent
		c.JSON(http.StatusOK, gin.H{"message": "If this email is registered, you will receive a reset link shortly."})
		return
	}

	// Generate a secure reset token
	b := make([]byte, 32)
	rand.Read(b)
	tokenStr := hex.EncodeToString(b)

	expr := time.Now().Add(1 * time.Hour)

	db.DB.Model(&user).Updates(map[string]interface{}{
		"password_reset_token":      tokenStr,
		"password_reset_expires_at": expr,
	})

	// Always use the Vercel Frontend for reset links in production
	baseUrl := "https://cloud-storage-lime.vercel.app"

	// If the config has a specific client URL that ISN'T localhost, use that instead
	cfg := config.LoadConfig()
	if cfg.NextClientURL != "" && cfg.NextClientURL != "http://localhost:3000" && cfg.NextClientURL != "http://localhost:3001" {
		baseUrl = cfg.NextClientURL
	}
	resetLink := baseUrl + "/reset-password?token=" + tokenStr

	// Send Email - Background goroutine to prevent the request from hanging
	// which causes the 502 Bad Gateway if the SMTP server is slow.
	go func(email, link string) {
		if err := services.SendPasswordResetEmail(email, link); err != nil {
			log.Printf("BACKGROUND ERROR: Failed to send reset email to %s: %v", email, err)
		} else {
			log.Printf("BACKGROUND SUCCESS: Sent reset email to %s", email)
		}
	}(user.Email, resetLink)

	c.JSON(http.StatusOK, gin.H{"message": "If this email is registered, you will receive a reset link shortly."})
}

type ResetPasswordReq struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

func ResetPassword(c *gin.Context) {
	var req ResetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request properties"})
		return
	}

	var user models.User
	if err := db.DB.Where("password_reset_token = ?", req.Token).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	if user.PasswordResetExpiresAt == nil || user.PasswordResetExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Reset token has expired"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}

	db.DB.Model(&user).Updates(map[string]interface{}{
		"password_hash":             string(hash),
		"password_reset_token":      nil,
		"password_reset_expires_at": nil,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Password has been successfully updated."})
}
