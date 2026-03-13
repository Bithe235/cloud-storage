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
	dbURL = strings.Replace(dbURL, "postgresql://", "postgres://", 1)
	db, err := sql.Open("postgres", dbURL)
	if err != nil { log.Fatal(err) }
	defer db.Close()

	rows, err := db.Query("SELECT id, email, password_hash, role, is_email_verified FROM cc_users WHERE role = 'admin'")
	if err != nil { log.Fatal(err) }
	defer rows.Close()

	for rows.Next() {
		var id, email, hash, role string
		var isVerified bool
		rows.Scan(&id, &email, &hash, &role, &isVerified)
		fmt.Printf("ID: %s\nEmail: %s\nRole: %s\nVerified: %v\nHash: %s\n", id, email, role, isVerified, hash)
	}
}
