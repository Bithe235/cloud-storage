package main

import (
	"fmt"

	"pentaract-bridge/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

func main() {
	cfg := config.LoadConfig()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   "0d6d96c2-54e2-4fed-be01-53b0906cabdc",
		"email": "master@pentaract.local",
		"exp":   4926489030,
	})
	tok, _ := token.SignedString([]byte(cfg.JWTSecret))
	fmt.Println("Token Generated with JWTSecret:", cfg.JWTSecret)
	fmt.Println(tok)
}
