# TEST REVIEW SUBMISSION

## Problem Diagnosis:
Reviews are not showing because:
1. localStorage was cleared (correct)
2. No API call to fetch existing reviews from database
3. ProductDetail only uses ReviewContext (localStorage-based)

## Solution Steps:

### Step 1: Test Review Submission via Browser Console

1. Open product page: `http://localhost:5173/products/1`
2. Make sure you're logged in
3. Open Browser Console (F12)
4. Run this code:

```javascript
// Test review submission
const token = localStorage.getItem('token');
console.log('Token:', token ? 'Found' : 'Not found');

fetch('http://localhost:5000/api/reviews', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    product_id: 1,
    rating: 5,
    comment: 'Test review from console - excellent product!'
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Response:', data);
})
.catch(err => {
  console.error('❌ Error:', err);
});
```

### Step 2: Check Backend Server
Make sure backend is running on port 5000:
```bash
# Check if server is running
curl http://localhost:5000/health
```

### Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Submit a review from the form
3. Look for POST request to `/api/reviews`
4. Check response:
   - ✅ Status 201 = Success
   - ❌ Status 401 = Not authenticated
   - ❌ Status 404 = Server not running
   - ❌ Failed to fetch = CORS or server offline

### Step 4: Common Issues

**Issue 1: Backend server not running**
```bash
cd backend
npm start
# or
node index.js
```

**Issue 2: CORS error**
Check backend/index.js has:
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

**Issue 3: User not logged in**
- Check localStorage.getItem('token')
- Should return JWT token
- If null, login first

**Issue 4: Wrong API URL**
ProductDetail.jsx uses:
```javascript
fetch('http://localhost:5000/api/reviews', ...)
```
Make sure backend runs on port 5000

## Expected Flow:

```
1. User clicks "Submit Review"
   ↓
2. handleSubmitReview() in ProductDetail.jsx
   ↓
3. POST http://localhost:5000/api/reviews
   ↓
4. Backend saves to database (status: PENDING)
   ↓
5. Returns: { message: "...", review: {...} }
   ↓
6. Frontend shows: "Review submitted successfully!"
   ↓
7. Admin dashboard auto-refreshes
   ↓
8. Review appears in dashboard (PENDING)
```

## Debug Commands:

### Check if review was saved:
```bash
node backend/check-reviews.js
```

### Check database directly:
```sql
SELECT * FROM reviews ORDER BY created_at DESC LIMIT 5;
```

### Check backend logs:
Look for console output in backend terminal:
```
POST /api/reviews
Submit review error: [if any error]
```

## Quick Fix Test:

Run this in browser console to verify backend is working:
```javascript
// 1. Check authentication
console.log('Token exists:', !!localStorage.getItem('token'));

// 2. Test API endpoint
fetch('http://localhost:5000/api/reviews/product/1')
  .then(res => res.json())
  .then(data => console.log('Existing reviews:', data))
  .catch(err => console.error('API Error:', err));
```
