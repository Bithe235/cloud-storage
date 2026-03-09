package services

import (
	"crypto/tls"
	"log"

	"pentaract-bridge/internal/config"

	"gopkg.in/gomail.v2"
)

func SendPasswordResetEmail(toEmail, resetLink string) error {
	cfg := config.LoadConfig()

	m := gomail.NewMessage()
	m.SetHeader("From", cfg.SMTPUser)
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Pentaract Cloud - Password Reset")

	htmlBody := `
	<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
		<h2 style="color: #333;">Password Reset Request</h2>
		<p>We received a request to reset your password for your Pentaract Cloud account.</p>
		<p>Click the button below to set a new password. This link will expire in 1 hour.</p>
		<div style="text-align: center; margin: 30px 0;">
			<a href="` + resetLink + `" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Reset Password</a>
		</div>
		<p style="color: #666; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
	</div>`

	m.SetBody("text/html", htmlBody)

	d := gomail.NewDialer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: false, ServerName: cfg.SMTPHost}

	if err := d.DialAndSend(m); err != nil {
		log.Println("Error sending email:", err)
		return err
	}

	return nil
}

func SendVerificationOTPEmail(toEmail, otp string) error {
	cfg := config.LoadConfig()

	m := gomail.NewMessage()
	m.SetHeader("From", cfg.SMTPUser)
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Pentaract Cloud - Verify Your Account")

	htmlBody := `
	<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
		<h2 style="color: #333;">Welcome to Pentaract Cloud!</h2>
		<p>Thank you for registering. To complete your account setup, please verify your email address using the following 6-digit code:</p>
		<div style="text-align: center; margin: 30px 0;">
			<span style="background-color: #f4f4f4; color: #000; padding: 12px 24px; font-size: 24px; font-family: monospace; font-weight: bold; border-radius: 4px; letter-spacing: 4px; display: inline-block;">` + otp + `</span>
		</div>
		<p style="color: #666; font-size: 14px;">This code will expire in 15 minutes. If you did not create an account, you can safely ignore this email.</p>
	</div>`

	m.SetBody("text/html", htmlBody)

	d := gomail.NewDialer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: false, ServerName: cfg.SMTPHost}

	if err := d.DialAndSend(m); err != nil {
		log.Println("Error sending verification email:", err)
		return err
	}

	return nil
}
