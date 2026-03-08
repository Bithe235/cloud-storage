package main

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load(".env")

	secretKey := os.Getenv("SECRET_KEY")
	if secretKey == "" {
		secretKey = "super-secret-key"
	}

	masterID := uuid.New().String()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   masterID,
		"email": "master@pentaract.local",
		"exp":   time.Now().Add(time.Hour * 24 * 365 * 100).Unix(), // 100 years
	})

	tokenString, err := token.SignedString([]byte(secretKey))
	if err != nil {
		fmt.Println("Error signing token:", err)
		return
	}

	f, _ := os.OpenFile(".env", os.O_APPEND|os.O_WRONLY, 0644)
	defer f.Close()
	f.WriteString(fmt.Sprintf("\nMASTER_UUID=%s\n", masterID))
	f.WriteString(fmt.Sprintf("RUST_MASTER_TOKEN=%s\n", tokenString))
}
