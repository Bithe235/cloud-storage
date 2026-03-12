package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// 1. Load context
	err := godotenv.Load("../../.env")
	if err != nil {
		godotenv.Load("../.env")
	}

	dbURL := os.Getenv("DATABASE_URL")
	chatIdStr := os.Getenv("TELEGRAM_CHAT_ID")
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")

	if dbURL == "" || chatIdStr == "" || botToken == "" {
		log.Fatal("DATABASE_URL, TELEGRAM_CHAT_ID, or TELEGRAM_BOT_TOKEN not found in .env")
	}

	// Clean up URL
	dbURL = strings.Replace(dbURL, "postgresql://", "postgres://", 1)

	// Parse chat ID
	chatId, err := strconv.ParseInt(chatIdStr, 10, 64)
	if err != nil {
		log.Fatalf("Invalid TELEGRAM_CHAT_ID: %v", err)
	}

	// 2. Connect to DB
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	// 3. Update Existing Storages
	fmt.Printf("Updating all existing storages to Chat ID: %d...\n", chatId)
	result, err := db.Exec("UPDATE storages SET chat_id = $1", chatId)
	if err != nil {
		log.Fatalf("Failed to update storages: %v", err)
	}
	rows, _ := result.RowsAffected()
	fmt.Printf("✅ Updated %d storages.\n", rows)

	// 4. Update Existing Workers
	fmt.Printf("Updating all storage workers to new Token...\n")
	result, err = db.Exec("UPDATE storage_workers SET token = $1", botToken)
	if err != nil {
		log.Fatalf("Failed to update workers: %v", err)
	}
	rows, _ = result.RowsAffected()
	fmt.Printf("✅ Updated %d workers.\n", rows)

	fmt.Println("\nAll existing buckets and workers are now synced with your .env config.")
}
