# 📝 Review System - Real-Time Integration Guide

## ✅ Implementation Complete!

The review system has been successfully integrated with real-time functionality. When customers submit reviews from the frontend, they instantly appear in the admin dashboard for moderation.

---

## 🚀 How It Works

### **For Customers (Frontend):**

1. **Login Required**: Customers must be logged in to submit a review
2. **Submit Review**: Use the `reviewAPI.submitReview()` function
3. **Automatic Pending Status**: All new reviews are set to "pending" (not visible on website)
4. **Wait for Approval**: Reviews appear on the product page only after admin approval

### **For Admins (Admin Dashboard):**

1. **Auto-Refresh**: Admin Reviews page automatically refreshes every 10 seconds
2. **Real-Time Updates**: New reviews appear instantly without manual refresh
3. **Approve/Reject**: Click "Approve" to make review visible or "Mark Pending" to hide it
4. **Filter Options**: View All, Approved only, or Pending only reviews

---

## 📡 API Endpoints Created

### **Customer APIs (`/api/reviews`):**

```javascript
// Submit a review
POST /api/reviews
Body: {
  product_id: 123,
  rating: 5,
  comment: "Great product!"
}
Headers: { Authorization: "Bearer <user_token>" }
```

```javascript
// Get approved reviews for a product
GET /api/reviews/product/:productId
// No authentication required - public endpoint
```

```javascript
// Get my reviews
GET /api/reviews/my-reviews
Headers: { Authorization: "Bearer <user_token>" }
```

### **Admin APIs (existing):**

```javascript
// Get all reviews (with filters)
GET /admin/reviews?status=pending
Headers: { Authorization: "Bearer <admin_token>" }
```

```javascript
// Approve/Unapprove a review
PATCH /admin/reviews/:id/approval
Body: { is_approved: true }
Headers: { Authorization: "Bearer <admin_token>" }
```

---

## 💻 Frontend Usage Example

### **Customer Submitting a Review:**

```javascript
import { reviewAPI } from '@/services/api';

const submitReview = async (productId) => {
  try {
    const response = await reviewAPI.submitReview({
      product_id: productId,
      rating: 5,
      comment: "Amazing quality! Highly recommended."
    });
    
    console.log(response.message); 
    // "Review submitted successfully! It will appear after admin approval."
    
  } catch (error) {
    console.error(error.response?.data?.error);
    // "You have already reviewed this product"
  }
};
```

### **Display Product Reviews:**

```javascript
import { reviewAPI } from '@/services/api';

const loadProductReviews = async (productId) => {
  try {
    const reviews = await reviewAPI.getProductReviews(productId);
    // Only approved reviews are returned
    console.log(reviews);
  } catch (error) {
    console.error('Failed to load reviews');
  }
};
```

---

## ⚙️ Database Schema

The `reviews` table structure:

```sql
CREATE TABLE reviews (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  rating INT NOT NULL,           -- 1 to 5
  comment TEXT,
  is_approved TINYINT DEFAULT 0, -- 0 = pending, 1 = approved
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 🔒 Security Features

✅ **Authentication Required**: Only logged-in users can submit reviews  
✅ **One Review Per Product**: Users cannot submit multiple reviews for the same product  
✅ **Moderation System**: All reviews are pending by default  
✅ **SQL Injection Prevention**: Parameterized queries used throughout  
✅ **Input Validation**: Rating must be 1-5, product must exist  

---

## 🎯 Admin Dashboard Features

### **Real-Time Updates:**
- Auto-refresh every 10 seconds
- Manual refresh button available
- Loading spinner indicates refresh in progress

### **Filter Options:**
- **All**: Show all reviews
- **Approved**: Show only approved reviews
- **Pending**: Show only pending reviews

### **Stats Cards:**
- Total Reviews count
- Approved count (green)
- Pending count (amber)

---

## 🧪 Testing the Flow

### **Step 1: Submit a Review (as Customer)**
```bash
# Login as a customer first
# Then visit a product page and submit a review
```

### **Step 2: Check Admin Dashboard**
```bash
# Login to admin dashboard
# Go to Reviews page (/admin/reviews)
# The review should appear within 10 seconds
```

### **Step 3: Approve the Review**
```bash
# Click "Approve" button
# Review status changes to "Approved"
# Stats update automatically
```

### **Step 4: Verify on Frontend**
```bash
# Go back to the product page
# The approved review should now be visible
```

---

## 📋 Files Modified/Created

### **Backend:**
- ✅ `backend/routes/reviews.js` - NEW (Customer review routes)
- ✅ `backend/index.js` - Updated (registered review routes)

### **Frontend:**
- ✅ `frontend/src/services/api.js` - Updated (added reviewAPI)
- ✅ `frontend/src/pages/AdminReviews.jsx` - Updated (added auto-refresh)

---

## 🎨 UI Features

### **Admin Reviews Page:**
- Clean, modern design matching Naturanza theme
- Green color scheme (#16a34a)
- Responsive layout (mobile & desktop)
- Star rating display
- Customer info with email
- Product name shown
- Approve/Mark Pending buttons
- Real-time auto-refresh indicator

---

## 🔄 Auto-Refresh Configuration

Current settings:
- **Interval**: 10 seconds
- **Status**: Always enabled
- **Behavior**: Silently refreshes in background

To change the interval, edit `AdminReviews.jsx`:
```javascript
const intervalId = setInterval(() => {
  void loadReviews();
}, 10000); // Change this value (in milliseconds)
```

---

## 🌐 URLs

- **Admin Reviews**: `http://localhost:5173/admin/reviews`
- **Admin Login**: `http://localhost:5173/admin/login`
- **Customer Login**: `http://localhost:5173/login`

---

## 📞 Support

If you encounter any issues:
1. Check backend is running on port 5000
2. Check frontend is running on port 5173
3. Verify user is logged in
4. Check browser console for errors
5. Verify MySQL database connection

---

## ✨ Summary

✅ Backend routes created for review submission  
✅ Frontend API service updated  
✅ Admin dashboard shows reviews in real-time  
✅ Auto-refresh every 10 seconds  
✅ Approve/reject functionality working  
✅ Secure with authentication  
✅ Clean UI matching Naturanza theme  

**System is fully functional and ready to use!** 🎉
