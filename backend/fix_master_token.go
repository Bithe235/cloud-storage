package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	godotenv.Load("../.env")

	dbUrl := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", dbUrl)
	if err != nil {
		fmt.Println("DB Open:", err)
		return
	}
	defer db.Close()

	var masterID string
	err = db.QueryRow("SELECT id FROM users WHERE email='master@pentaract.local'").Scan(&masterID)
	if err != nil {
		fmt.Println("DB Query:", err)
		return
	}

	secretKey := os.Getenv("SECRET_KEY")

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   masterID,
		"email": "master@pentaract.local",
		"exp":   time.Now().Add(time.Hour * 24 * 365 * 100).Unix(),
	})

	tokenString, err := token.SignedString([]byte(secretKey))
	if err != nil {
		fmt.Println("Token Sign:", err)
		return
	}

	contentBytes, err := os.ReadFile("../.env")
	if err != nil {
		fmt.Println("Read .env:", err)
		return
	}

	lines := strings.Split(string(contentBytes), "\n")
	for i, line := range lines {
		if strings.HasPrefix(line, "MASTER_UUID=") {
			lines[i] = fmt.Sprintf("MASTER_UUID=%s", masterID)
		} else if strings.HasPrefix(line, "RUST_MASTER_TOKEN=") {
			lines[i] = fmt.Sprintf("RUST_MASTER_TOKEN=%s", tokenString)
		}
	}

	err = os.WriteFile("../.env", []byte(strings.Join(lines, "\n")), 0644)
	if err != nil {
		fmt.Println("Write .env:", err)
		return
	}

	fmt.Println("SUCCESS")
}
