package models

import (
	"time"
)

type User struct {
	ID            string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Email         string    `gorm:"not null" json:"email"`
	Password      string    `gorm:"column:password_hash;not null" json:"-"`
	PlanID        string    `gorm:"default:'plan_free'" json:"planId"`
	PlanExpiresAt time.Time `json:"planExpiresAt"`
	Role          string    `gorm:"default:'user'" json:"role"` // admin or user
	IsBanned      bool      `gorm:"default:false" json:"isBanned"`
	CreatedAt     time.Time `json:"createdAt"`
	Buckets       []Bucket  `gorm:"foreignKey:OwnerId;references:ID" json:"buckets,omitempty"`
	ApiKeys       []ApiKey  `gorm:"foreignKey:UserId;references:ID" json:"apiKeys,omitempty"`
}

type Bucket struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	PentaractID string    `gorm:"type:uuid;not null" json:"pentaractId"`
	OwnerId     string    `gorm:"type:uuid;not null;index" json:"ownerId"`
	CreatedAt   time.Time `json:"createdAt"`
	Files       []File    `gorm:"foreignKey:BucketId;references:ID" json:"files,omitempty"`
	Owner       User      `gorm:"foreignKey:OwnerId;references:ID" json:"owner,omitempty"`
}

type File struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	BucketId  string    `gorm:"type:uuid;not null;index" json:"bucketId"`
	Name      string    `gorm:"not null" json:"name"`
	Path      string    `gorm:"not null" json:"path"`
	Size      int64     `gorm:"default:0" json:"size"`
	MimeType  string    `gorm:"default:'application/octet-stream'" json:"mimeType"`
	IsFolder  bool      `gorm:"default:false" json:"isFolder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Bucket    Bucket    `gorm:"foreignKey:BucketId;references:ID" json:"bucket,omitempty"`
}

type ApiKey struct {
	ID          string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	KeyHash     string     `gorm:"uniqueIndex;not null" json:"-"` // We store the hash securely, return raw key once
	Prefix      string     `gorm:"not null" json:"prefix"`        // pk_xxx... portion returned in queries
	Name        string     `gorm:"not null" json:"name"`
	Permissions string     `gorm:"default:'read'" json:"permissions"` // comma separated: read,write,delete
	UserId      string     `gorm:"type:uuid;not null;index" json:"userId"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastUsed    *time.Time `json:"lastUsed"`
	User        User       `gorm:"foreignKey:UserId;references:ID" json:"user,omitempty"`
}

func (User) TableName() string   { return "cc_users" }
func (Bucket) TableName() string { return "cc_buckets" }
func (File) TableName() string   { return "cc_files" }
func (ApiKey) TableName() string { return "cc_api_keys" }
