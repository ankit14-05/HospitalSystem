require('dotenv').config();
const labService = require('./src/services/lab.service');
const labController = require('./src/controllers/lab.controller');

// Mock request
const req = {
  body: {
    labId: 1,
    roomNo: '999X'
  },
  user: {
    id: 1,
    hospitalId: 1
  }
};

// Mock response
const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log('Response:', data);
    process.exit(0);
  }
};

// Mock next
const next = (err) => {
  console.error('BACKEND ERROR DETECTED:', err);
  process.exit(1);
};

console.log('Testing createRoom...');
labController.createRoom(req, res, next);
