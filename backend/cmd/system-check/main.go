package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	PentaractURL    string
	RustMasterToken string
	TelegramToken   string
	TelegramChatID  string
}

func main() {
	fmt.Println("=================================================")
	fmt.Println("   🚀 Pentaract Full System Diagnosis   ")
	fmt.Println("=================================================")

	// 1. Load Environment
	err := godotenv.Load("../../.env")
	if err != nil {
		godotenv.Load("../.env")
	}

	cfg := &Config{
		PentaractURL:    os.Getenv("PENTARACT_API_URL"),
		RustMasterToken: os.Getenv("RUST_MASTER_TOKEN"),
		TelegramToken:   os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramChatID:  os.Getenv("TELEGRAM_CHAT_ID"),
	}

	if cfg.PentaractURL == "" {
		cfg.PentaractURL = "http://127.0.0.1:8041/api"
	}

	// 2. Check Rust Connection
	fmt.Printf("[1/4] Checking Rust Engine at %s... ", cfg.PentaractURL)
	resp, err := http.Get(cfg.PentaractURL + "/storages")
	if err != nil {
		fmt.Printf("❌ FAILED to connect: %v\n", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == 401 {
			fmt.Println("✅ REACHABLE (Unauthorized as expected).")
		} else {
			fmt.Printf("❓ Unexpected Status: %d\n", resp.StatusCode)
		}
	}

	// 3. Check Master Token
	fmt.Printf("[2/4] Verifying Master Token... ")
	req, _ := http.NewRequest("GET", cfg.PentaractURL+"/storages", nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ ERROR: %v\n", err)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			fmt.Println("✅ VALID.")
		} else {
			body, _ := io.ReadAll(resp.Body)
			fmt.Printf("❌ INVALID (Status %d): %s\n", resp.StatusCode, string(body))
		}
	}

	// 4. Check Telegram Config
	fmt.Println("[3/4] Verifying Telegram Integration...")
	testTelegram(cfg.TelegramToken, cfg.TelegramChatID)

	// 5. Full End-to-End Test (Optional)
	fmt.Println("\n[4/4] Performing End-to-End File Upload Test...")
	performE2ETest(cfg)

	fmt.Println("\n=================================================")
	fmt.Println("   Diagnosis Complete   ")
	fmt.Println("=================================================")
}

func testTelegram(token, chatId string) {
	if token == "" || chatId == "" {
		fmt.Println("   ❌ Missing Telegram credentials in .env")
		return
	}

	// getMe
	resp, err := http.Get(fmt.Sprintf("https://api.telegram.org/bot%s/getMe", token))
	if err != nil || resp.StatusCode != 200 {
		fmt.Println("   ❌ Bot Token is INVALID")
		return
	}
	fmt.Println("   ✅ Bot Token: VALID")

	// getChat
	resp, err = http.Get(fmt.Sprintf("https://api.telegram.org/bot%s/getChat?chat_id=%s", token, chatId))
	if err != nil || resp.StatusCode != 200 {
		fmt.Printf("   ❌ Chat ID (%s): INACCESSIBLE\n", chatId)
		return
	}
	fmt.Printf("   ✅ Chat ID: ACCESSIBLE\n")

	// sendDocument (Direct Test)
	fmt.Print("   ... Testing Direct File Upload to Telegram... ")
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendDocument", token)
	boundary := "---TestBoundary---"
	bodyBuf := &bytes.Buffer{}
	fmt.Fprintf(bodyBuf, "--%s\r\n", boundary)
	fmt.Fprintf(bodyBuf, "Content-Disposition: form-data; name=\"chat_id\"\r\n\r\n%s\r\n", chatId)
	fmt.Fprintf(bodyBuf, "--%s\r\n", boundary)
	fmt.Fprintf(bodyBuf, "Content-Disposition: form-data; name=\"document\"; filename=\"test.txt\"\r\n")
	fmt.Fprintf(bodyBuf, "Content-Type: text/plain\r\n\r\n")
	bodyBuf.WriteString("Direct Upload Check")
	fmt.Fprintf(bodyBuf, "\r\n--%s--\r\n", boundary)

	req, _ := http.NewRequest("POST", url, bodyBuf)
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+boundary)

	resp, err = http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		fmt.Println("❌ FAILED")
	} else {
		fmt.Println("✅ SUCCESS")
	}
}

func performE2ETest(cfg *Config) {
	// a. Create temporary test storage
	name := fmt.Sprintf("test-%d", time.Now().Unix())
	fmt.Printf("   a. Provisioning test storage '%s'... ", name)

	chatIdInt, _ := strconv.ParseInt(cfg.TelegramChatID, 10, 64)
	payload := map[string]interface{}{"name": name, "chat_id": chatIdInt}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", cfg.PentaractURL+"/storages", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ FAILED: %v\n", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ FAILED (Status %d): %s\n", resp.StatusCode, string(body))
		return
	}

	var storageResp struct{ ID string }
	json.NewDecoder(resp.Body).Decode(&storageResp)
	storageId := storageResp.ID
	fmt.Printf("✅ (ID: %s)\n", storageId)

	// b. Register Worker
	workerName := fmt.Sprintf("TestWorker-%d", time.Now().Unix())
	fmt.Printf("   b. Linking Telegram Worker '%s'... ", workerName)
	payload = map[string]interface{}{
		"name":       workerName,
		"token":      cfg.TelegramToken,
		"storage_id": storageId,
	}
	body, _ = json.Marshal(payload)
	req, _ = http.NewRequest("POST", cfg.PentaractURL+"/storage_workers", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ FAILED: %v\n", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ FAILED (Status %d): %s\n", resp.StatusCode, string(body))
		return
	}
	fmt.Println("✅ SUCCESS")

	// c. Attempt actual File Upload to Rust
	fmt.Printf("   c. Uploading test file to Rust storage... ")

	fileBuf := &bytes.Buffer{}
	mw := multipart.NewWriter(fileBuf)

	part, _ := mw.CreateFormFile("file", "test.txt")
	part.Write([]byte("Pentaract System Check"))

	mw.WriteField("path", "root")
	mw.Close()

	uploadUrl := fmt.Sprintf("%s/storages/%s/files/upload", cfg.PentaractURL, storageId)
	req, _ = http.NewRequest("POST", uploadUrl, fileBuf)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)
	req.Header.Set("Content-Type", mw.FormDataContentType())

	start := time.Now()
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ FAILED to connect: %v\n", err)
	} else {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode >= 400 {
			fmt.Printf("❌ FAILED (Status %d): %s\n", resp.StatusCode, string(body))
		} else {
			fmt.Printf("✅ SUCCESS (Took %v)\n", time.Since(start))
			fmt.Println("\n🏁 RESULT: The Rust Engine and Telegram integration are working PERFECTLY.")
		}
	}

	// d. Cleanup
	fmt.Printf("   d. Cleaning up test storage... ")
	// Delete worker first
	// (Pentaract actually deletes it with storage, but storage delete was failing due to FK if we didn't wait)
	// Let's just delete storage
	req, _ = http.NewRequest("DELETE", cfg.PentaractURL+"/storages/"+storageId, nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)
	resp, _ = http.DefaultClient.Do(req)
	if resp != nil && resp.StatusCode < 400 {
		fmt.Println("✅ DONE")
	} else {
		fmt.Println("⚠️ Skip/Manual cleanup")
	}
}
