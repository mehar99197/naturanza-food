# Password Reset Email Setup Guide

This guide will help you configure the password reset email functionality for Naturanza Foods.

## 🚀 Quick Setup

The password reset system is now fully implemented and connected to your database. You just need to configure Gmail SMTP to send emails.

## 📧 Gmail App Password Setup (Required)

To send emails through Gmail, you need to create an **App Password** (regular Gmail passwords won't work due to security restrictions).

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **"2-Step Verification"**
3. Follow the steps to enable 2FA if not already enabled

### Step 2: Generate an App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select **"Mail"** as the app
3. Select **"Windows Computer"** as the device (or your device type)
4. Click **"Generate"**
5. **Copy the 16-character password** that appears (it looks like: `xxxx xxxx xxxx xxxx`)

### Step 3: Update Your .env File

Open `backend/.env` and update the `SMTP_PASS` value:

```env
# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=meharahmad6599197@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # <-- Paste your App Password here (with or without spaces)
EMAIL_FROM_NAME=Naturanza Foods
EMAIL_FROM=meharahmad6599197@gmail.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

### Step 4: Restart the Backend Server

After updating the `.env` file, restart your backend server:

```bash
cd backend
npm run dev
```

## ✅ How It Works

1. **User requests password reset**: Goes to `/forgot-password` and enters their email
2. **Token generated**: A secure 64-character token is created and stored (hashed) in the database
3. **Email sent**: A professional HTML email is sent with a reset link
4. **User clicks link**: Redirected to `/reset-password?token=xxx`
5. **Password updated**: User enters new password, token is validated and marked as used
6. **Success**: User can now log in with new password

## 📁 Files Created/Modified

### New Files:
- `backend/utils/emailService.js` - Email sending utility with Gmail SMTP
- `backend/utils/passwordResetTokens.js` - Token generation and validation
- `backend/schema/migrations/add_password_reset_tokens.sql` - Database table
- `backend/run-password-reset-migration.js` - Migration script

### Modified Files:
- `backend/routes/auth.js` - Updated forgot-password and reset-password endpoints
- `backend/.env` - Added email configuration

## 🔒 Security Features

- **Hashed tokens**: Only SHA-256 hashed tokens are stored in the database
- **Single-use tokens**: Tokens are marked as used after successful reset
- **1-hour expiry**: Tokens expire after 60 minutes
- **Rate limiting**: Previous tokens are invalidated when new one is requested
- **No email enumeration**: Same response whether email exists or not

## 📮 Email Deliverability Tips

To ensure emails go to **inbox** instead of **spam**:

1. ✅ **Already configured**: Proper email headers (X-Priority, Importance)
2. ✅ **Already configured**: List-Unsubscribe header
3. ✅ **Already configured**: Both HTML and plain text versions
4. ✅ **Already configured**: Professional email template with branding

### Additional Steps (For Production):

1. **Use a custom domain email**: `noreply@naturanzafoods.com` instead of Gmail
2. **Set up SPF record**: Add to your domain's DNS
3. **Set up DKIM**: Configure with your email provider
4. **Set up DMARC**: Add to your domain's DNS
5. **Consider using**: SendGrid, Mailgun, or Amazon SES for production

## 🧪 Testing

1. Start your backend server: `cd backend && npm run dev`
2. Start your frontend: `cd frontend && npm run dev`
3. Go to `http://localhost:5173/forgot-password`
4. Enter a registered user's email
5. Check inbox (or spam folder) for the reset email
6. Click the link and set a new password

## ❓ Troubleshooting

### Email not sending?
- Check that `SMTP_PASS` is your Gmail App Password (not regular password)
- Ensure 2FA is enabled on your Google account
- Check backend console for error messages

### Email going to spam?
- First few emails might go to spam - mark as "Not Spam"
- For production, use a dedicated email service (SendGrid, etc.)

### Token invalid/expired?
- Tokens expire after 1 hour
- Each new request invalidates previous tokens
- Tokens can only be used once

## 📞 Support

If you encounter any issues, check the backend console logs for detailed error messages.
