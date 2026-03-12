package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	err := godotenv.Load("../../.env")
	if err != nil {
		godotenv.Load("../.env")
	}

	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatId := os.Getenv("TELEGRAM_CHAT_ID")

	if token == "" || chatId == "" {
		fmt.Println("❌ Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in .env")
		return
	}

	fmt.Printf("🔍 Testing Telegram Config...\nBot Token: %s...%s\nTarget Chat ID: %s\n\n", token[:5], token[len(token)-5:], chatId)

	// 1. Test getMe (Verify Bot Token)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getMe", token)
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("❌ Connection Error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Invalid Bot Token (HTTP %d): %s\n", resp.StatusCode, string(body))
		return
	}
	fmt.Println("✅ Bot Token is VALID.")

	// 2. Test getChat (Verify Chat ID and Bot Membership)
	url = fmt.Sprintf("https://api.telegram.org/bot%s/getChat", token)
	req, _ := http.NewRequest("GET", url, nil)
	q := req.URL.Query()
	q.Add("chat_id", chatId)
	req.URL.RawQuery = q.Encode()

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ Error checking Chat ID: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Chat ID Invalid or Bot is not a member (HTTP %d):\n   %s\n", resp.StatusCode, string(body))

		// Helpful tip for common mistakes
		idNum, _ := strconv.ParseInt(chatId, 10, 64)
		if idNum > 0 && idNum < 1000000000000 {
			fmt.Println("\n💡 Tip: If this is a Group or Channel, the ID MUST start with a minus sign (e.g., -100123456789).")
		} else {
			fmt.Println("\n💡 Tip: If this is a Private Chat, make sure you have sent /start to the bot.")
		}
		return
	}
	fmt.Println("✅ Chat ID is ACCESSIBLE by the bot.")

	// 3. Test sending a small "chunk" (Verify Permission to upload)
	url = fmt.Sprintf("https://api.telegram.org/bot%s/sendDocument", token)

	// Boundary for multipart
	boundary := "---TestBoundary---"
	bodyBuf := &bytes.Buffer{}

	// Add Chat ID
	fmt.Fprintf(bodyBuf, "--%s\r\n", boundary)
	fmt.Fprintf(bodyBuf, "Content-Disposition: form-data; name=\"chat_id\"\r\n\r\n%s\r\n", chatId)

	// Add File
	fmt.Fprintf(bodyBuf, "--%s\r\n", boundary)
	fmt.Fprintf(bodyBuf, "Content-Disposition: form-data; name=\"document\"; filename=\"test_chunk.txt\"\r\n")
	fmt.Fprintf(bodyBuf, "Content-Type: text/plain\r\n\r\n")
	bodyBuf.WriteString("Pentaract Test Chunk - Verification successful.")
	fmt.Fprintf(bodyBuf, "\r\n--%s--\r\n", boundary)

	req, _ = http.NewRequest("POST", url, bodyBuf)
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+boundary)

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ Error sending test document: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Final Test Failed: Bot cannot upload files to this chat (HTTP %d):\n   %s\n", resp.StatusCode, string(body))
		return
	}

	fmt.Println("✅ Success! The Bot can successfully upload chunks to this chat.")
	fmt.Println("\nResult: Your Telegram Configuration is 100% CORRECT.")
}
