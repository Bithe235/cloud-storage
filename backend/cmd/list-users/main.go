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
	err := godotenv.Load("../../.env")
	if err != nil {
		godotenv.Load("../.env")
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

	// 3. Query all users
	rows, err := db.Query("SELECT email, is_email_verified FROM cc_users LIMIT 50")
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	defer rows.Close()

	fmt.Println("Recent Users:")
	for rows.Next() {
		var email string
		var verified bool
		rows.Scan(&email, &verified)
		fmt.Printf("- %s (Verified: %v)\n", email, verified)
	}
}
