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
	godotenv.Load("../.env")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not found")
	}
	dbURL = strings.Replace(dbURL, "postgresql://", "postgres://", 1)
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT email, role FROM cc_users WHERE role = 'admin'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Admin Users:")
	for rows.Next() {
		var email, role string
		rows.Scan(&email, &role)
		fmt.Printf("- %s (Role: %s)\n", email, role)
	}
}
