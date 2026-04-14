#!/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Naturanzafood - Start Backend & Frontend          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Clean up ports first
echo "🧹 Cleaning up ports 5000 and 5173..."
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

echo "Starting Express.js Backend on port 5000..."
cd backend
npm start &
BACKEND_PID=$!
echo "✅ Express.js started (PID: $BACKEND_PID)"

echo ""
echo "Waiting 3 seconds for backend to initialize..."
sleep 3

echo ""
echo "Testing backend connection..."
curl -s http://localhost:5000/api/health && echo "" || echo "❌ Backend not responding"

echo ""
echo "Starting Frontend on port 5173..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Waiting 3 seconds for frontend to start..."
sleep 3

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                   ✅ ALL STARTED!                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Backend:   http://localhost:5000/api"
echo "Frontend:  http://localhost:5173    (FIXED PORT - Google OAuth Compatible)"
echo "Network:   http://192.168.1.24:5173"
echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "📝 Port Configuration:"
echo "   - Frontend will ALWAYS use port 5173 (strictPort enabled)"
echo "   - If port 5173 is busy, frontend will fail instead of using 5174"
echo ""
echo "To stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Or press Ctrl+C in each terminal"
