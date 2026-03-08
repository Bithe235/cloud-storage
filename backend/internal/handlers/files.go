package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
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
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	path := c.Query("path")
	// Strip leading/trailing slashes — Rust does not accept paths starting with '/'
	path = strings.Trim(path, "/")

	cfg := config.LoadConfig()
	url := cfg.PentaractURL + "/storages/" + storageId + "/files/tree"
	if path != "" {
		url += "?path=" + path
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
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bucket not found"})
		return
	}
	storageId := bucket.PentaractID

	contentType := c.GetHeader("Content-Type")
	cfg := config.LoadConfig()

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
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
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

func DownloadFile(c *gin.Context) {
	userId := c.MustGet("userId").(string)
	bucketId := c.Param("id")

	var bucket models.Bucket
	if err := db.DB.Where("id = ? AND owner_id = ?", bucketId, userId).First(&bucket).Error; err != nil {
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
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach storage engine"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		c.JSON(resp.StatusCode, gin.H{"error": "File not found or download failed"})
		return
	}

	// Forward content-disposition and content-type from Rust
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	contentDisposition := resp.Header.Get("Content-Disposition")
	if contentDisposition != "" {
		c.Header("Content-Disposition", contentDisposition)
	}
	c.DataFromReader(http.StatusOK, resp.ContentLength, contentType, resp.Body, nil)
}
