package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"pentaract-bridge/internal/config"
	"pentaract-bridge/internal/db"
	"pentaract-bridge/internal/models"

	"github.com/gin-gonic/gin"
)

func ListFiles(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	userRole, _ := c.Get("userRole")
	query := db.DB.Where("id = ?", bucketId)
	if userRole != "admin" {
		query = query.Where("owner_id = ?", userId)
	}

	if err := query.First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	path := c.Query("path")
	search := c.Query("search")
	// Strip leading/trailing slashes — Rust does not accept paths starting with '/'
	path = strings.Trim(path, "/")

	cfg := config.LoadConfig()
	var url string
	if search != "" {
		// Use search endpoint if search query is provided
		url = cfg.PentaractURL + "/storages/" + storageId + "/files/search"
		if path != "" {
			url += "/" + path
		}
		url += "?search_path=" + strings.Trim(search, "/")
	} else {
		// Default to tree view
		url = cfg.PentaractURL + "/storages/" + storageId + "/files/tree"
		if path != "" {
			url += "/" + path
		}
	}

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach storage engine"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
		return
	}

	c.DataFromReader(http.StatusOK, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}

func UploadFile(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	userRole, _ := c.Get("userRole")
	query := db.DB.Where("id = ?", bucketId)
	if userRole != "admin" {
		query = query.Where("owner_id = ?", userId)
	}

	if err := query.First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	contentType := c.GetHeader("Content-Type")
	cfg := config.LoadConfig()

	// Billing check: Limit storage usage based on user's active plan
	var user models.User
	if err := db.DB.Where("id = ?", userId).First(&user).Error; err == nil {
		plan := GetPlan(user.PlanID)
		used := GetUsedStorage(userId)
		limit := plan.Limit

		// If Content-Length is provided, include it in the used storage calc to prevent overflow midway
		contentLength, _ := strconv.ParseInt(c.Request.Header.Get("Content-Length"), 10, 64)

		// 1. Check if single file exceeds plan's max file size
		if plan.MaxFileSize > 0 && contentLength > plan.MaxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("File too large. Your plan allows up to %s per file.", formatBytes(plan.MaxFileSize))})
			return
		}

		// 2. Check if total storage limit would be exceeded
		if used+contentLength > limit {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "Storage limit exceeded. Please upgrade your plan."})
			return
		}
	}

	// 1. Detect if it's JSON (Create Folder)
	if strings.HasPrefix(contentType, "application/json") {
		var body struct {
			Path       string `json:"path"`
			FolderName string `json:"folderName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		payload := map[string]string{
			"path":        body.Path,
			"folder_name": body.FolderName,
		}
		jsonPayload, _ := json.Marshal(payload)

		url := cfg.PentaractURL + "/storages/" + storageId + "/files/create_folder"
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Storage engine proxy error"})
			return
		}
		defer resp.Body.Close()

		c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
		return
	}

	// 2. Otherwise it's multipart streaming — use 'upload' endpoint (constructs path from multipart fields)
	url := cfg.PentaractURL + "/storages/" + storageId + "/files/upload"
	req, _ := http.NewRequest("POST", url, c.Request.Body)               // Pipe
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type")) // Must preserve boundary
	req.Header.Set("Content-Length", c.Request.Header.Get("Content-Length"))
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Storage engine proxy error"})
		return
	}
	defer resp.Body.Close()

	// Read Rust API response directly to Client
	var respBody bytes.Buffer
	io.Copy(&respBody, resp.Body)
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody.Bytes())
}

func DeleteFile(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	userRole, _ := c.Get("userRole")
	query := db.DB.Where("id = ?", bucketId)
	if userRole != "admin" {
		query = query.Where("owner_id = ?", userId)
	}

	if err := query.First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}
	// Strip leading slash — Rust path does not start with '/'
	path = strings.TrimPrefix(path, "/")

	cfg := config.LoadConfig()
	// Rust endpoint: DELETE /storages/:id/files/*path
	url := cfg.PentaractURL + "/storages/" + storageId + "/files/" + path

	req, _ := http.NewRequest("DELETE", url, nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach storage engine"})
		return
	}
	defer resp.Body.Close()

	c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}

// DownloadFile fetches the full file from Rust (which reassembles Telegram chunks),
// buffers it, then sends it to the client with correct Content-Length, Content-Type,
// and Content-Disposition headers so browsers and IDM can show filesize and progress.
func DownloadFile(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	userRole, _ := c.Get("userRole")
	query := db.DB.Where("id = ?", bucketId)
	if userRole != "admin" {
		query = query.Where("owner_id = ?", userId)
	}

	if err := query.First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	path := c.Query("path")
	if path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}
	path = strings.TrimPrefix(path, "/")

	cfg := config.LoadConfig()
	url := cfg.PentaractURL + "/storages/" + storageId + "/files/download/" + path

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+cfg.RustMasterToken)

	client := &http.Client{Timeout: 0} // no timeout for large files
	resp, err := client.Do(req)
	if err != nil {
		log.Println("Download proxy error:", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach storage engine"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("Download Rust error %d: %s", resp.StatusCode, string(bodyBytes))
		c.JSON(resp.StatusCode, gin.H{"error": "File not found or download failed"})
		return
	}

	// Query the exact file size from the Rust database to avoid buffering
	var fileSize int64
	if err := db.DB.Table("files").Select("size").Where("storage_id = ? AND path = ?", storageId, path).Scan(&fileSize).Error; err != nil {
		fileSize = 0 // Fallback if size lookup fails
	}

	// Determine filename and Content-Type
	filename := filepath.Base(path)
	if filename == "" || filename == "." {
		filename = "download.bin"
	}
	ct := mime.TypeByExtension(filepath.Ext(filename))
	if ct == "" {
		ct = "application/octet-stream"
	}

	// Set headers BEFORE streaming
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Type", ct)
	if fileSize > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", fileSize))
	} else if resp.ContentLength > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", resp.ContentLength))
	}
	c.Header("Accept-Ranges", "bytes")

	// Write HTTP status Code
	c.Writer.WriteHeader(http.StatusOK)

	// Stream directly from Rust response to Client — NO BUFFERING!
	// This reduces the "Preparing chunks..." time because the browser starts
	// receiving bytes the millisecond Rust sends its first byte
	_, err = io.Copy(c.Writer, resp.Body)
	if err != nil {
		log.Println("Download stream error:", err)
		return
	}
}
