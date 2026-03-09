package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// 1. Load context
	err := godotenv.Load("../.env")
	if err != nil {
		godotenv.Load(".env")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not found in .env")
	}
	dbURL = strings.Replace(dbURL, "postgresql://", "postgres://", 1)

	// 2. Connect to DB
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	// 3. Query storages
	rows, err := db.Query("SELECT id, name, chat_id FROM storages ORDER BY id DESC LIMIT 5")
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	defer rows.Close()

	fmt.Println("Recent Storages:")
	for rows.Next() {
		var id, name string
		var chatId int64
		rows.Scan(&id, &name, &chatId)
		fmt.Printf("- ID: %s, Name: %s, ChatID: %d\n", id, name, chatId)
	}
}
