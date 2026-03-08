package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"pentaract-bridge/internal/config"
)

type StorageResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	ChatID int64  `json:"chat_id"`
}

func CreatePentaractStorage(name string, chatId int64) (string, error) {
	cfg := config.LoadConfig()
	url := cfg.PentaractURL + "/storages"

	// Construct exactly what Rust InStorageSchema expects
	payload := map[string]interface{}{
		"name":    name,
		"chat_id": chatId,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Pentaract API error: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	var response StorageResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", err
	}

	return response.ID, nil
}

// InStorageWorkerSchema
// pub name: String,
// pub token: String,
// pub storage_id: Option<Uuid>,
func RegisterStorageWorker(storageId string, botToken string) error {
	cfg := config.LoadConfig()
	url := cfg.PentaractURL + "/storage_workers"

	payload := map[string]interface{}{
		"name":       "Master Bot",
		"token":      botToken,
		"storage_id": storageId,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	// Must authenticate using master token
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Pentaract storage worker error: %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
