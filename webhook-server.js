const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5678;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint
app.post('/webhook-test/:id', upload.single('audio'), (req, res) => {
  console.log('🎯 Webhook received!');
  console.log('📋 Request ID:', req.params.id);
  console.log('📝 Text:', req.body.text);
  console.log('⏰ Timestamp:', req.body.timestamp);
  console.log('✅ Status:', req.body.status);
  console.log('⏱️ Duration:', req.body.duration);
  
  if (req.file) {
    console.log('🎵 Audio file received:', req.file.filename);
    console.log('📁 File path:', req.file.path);
    console.log('📏 File size:', req.file.size, 'bytes');
  } else {
    console.log('❌ No audio file received');
  }
  
  // Log the complete request
  console.log('📦 Complete request body:', req.body);
  console.log('📦 Complete request files:', req.file);
  
  // Send success response
  res.status(200).json({
    success: true,
    message: 'Webhook received successfully',
    receivedAt: new Date().toISOString(),
    data: {
      text: req.body.text,
      timestamp: req.body.timestamp,
      status: req.body.status,
      duration: req.body.duration,
      audioFile: req.file ? req.file.filename : null
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Webhook server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook server running on http://192.168.1.78:${PORT}`);
  console.log(`🔗 Health check: http://192.168.1.78:${PORT}/health`);
  console.log(`📡 Webhook endpoint: http://192.168.1.78:${PORT}/webhook-test/5891af11-e2a1-445f-a0ba-240d2b783f2b`);
  console.log('⏳ Waiting for webhook calls...');
});

// Handle errors
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: error.message
  });
});

