package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "Ba91374b7"
	hash := "$2a$10$Z8hp95hKCfgT6oL99zy70ebgewect5XfuefAxznZMrKu/JaukY5vq"
	
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err == nil {
		fmt.Println("Password is correct!")
	} else {
		fmt.Println("Password is incorrect.")
	}
}
