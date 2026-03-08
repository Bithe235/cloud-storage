package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	PentaractURL     string
	NextClientURL    string
	TelegramChatID   int64
	TelegramBotToken string
	RustMasterToken  string
}

func LoadConfig() *Config {
	err := godotenv.Load("../../.env") // Load parent .env if exists
	if err != nil {
		log.Println("No .env file found in parent, looking in current dir")
		godotenv.Load()
	}

	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8080"
	}

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		dbUrl = "postgres://pentaract:pentaract@localhost:5432/pentaract?sslmode=disable"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = os.Getenv("SECRET_KEY")
	}
	if jwtSecret == "" {
		jwtSecret = "super-secret-key"
	}

	pentaractURL := os.Getenv("PENTARACT_API_URL")
	if pentaractURL == "" {
		pentaractURL = "http://localhost:8000/api"
	}

	nextClientURL := os.Getenv("NEXT_CLIENT_URL")
	if nextClientURL == "" {
		nextClientURL = "http://localhost:3000"
	}

	chatIdStr := os.Getenv("TELEGRAM_CHAT_ID")
	var chatId int64 = 0
	if chatIdStr != "" {
		parsedChatID, err := strconv.ParseInt(chatIdStr, 10, 64)
		if err != nil {
			log.Printf("Error parsing TELEGRAM_CHAT_ID '%s': %v", chatIdStr, err)
		} else {
			chatId = parsedChatID
		}
	}

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	masterToken := os.Getenv("RUST_MASTER_TOKEN")

	return &Config{
		Port:             port,
		DatabaseURL:      dbUrl,
		JWTSecret:        jwtSecret,
		PentaractURL:     pentaractURL,
		NextClientURL:    nextClientURL,
		TelegramChatID:   chatId,
		TelegramBotToken: botToken,
		RustMasterToken:  masterToken,
	}
}
