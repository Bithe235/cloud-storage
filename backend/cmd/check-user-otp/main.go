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
	if len(os.Args) < 2 {
		log.Fatal("Please provide email: go run check_user_otp.go user@example.com")
	}
	emailArg := os.Args[1]

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

	// 3. Query
	var email string
	var otp sql.NullString
	var expires sql.NullTime
	var verified bool

	err = db.QueryRow("SELECT email, email_verification_otp, email_verification_otp_expires_at, is_email_verified FROM cc_users WHERE email = $1", emailArg).Scan(&email, &otp, &expires, &verified)
	if err != nil {
		if err == sql.ErrNoRows {
			// Try case-insensitive
			err = db.QueryRow("SELECT email, email_verification_otp, email_verification_otp_expires_at, is_email_verified FROM cc_users WHERE email ILIKE $1", emailArg).Scan(&email, &otp, &expires, &verified)
			if err != nil {
				log.Fatalf("User not found: %v", err)
			}
			fmt.Printf("⚠️ Case-insensitive match found: %s\n", email)
		} else {
			log.Fatalf("Query error: %v", err)
		}
	}

	fmt.Printf("User: %s\n", email)
	fmt.Printf("Verified: %v\n", verified)
	if otp.Valid {
		fmt.Printf("OTP: [%s]\n", otp.String)
	} else {
		fmt.Println("OTP: NULL")
	}
	if expires.Valid {
		fmt.Printf("Expires: %v\n", expires.Time)
	}
}
