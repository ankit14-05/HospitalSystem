require('dotenv').config();
const labService = require('./src/services/lab.service');
const labController = require('./src/controllers/lab.controller');

async function test() {
  // 1. Get existing rooms
  const rooms = await labService.getAvailableLabRooms(1);
  if (rooms.length === 0) {
    console.log('No rooms found to test duplicates.');
    process.exit(0);
  }

  const existingRoom = rooms[0].RoomNo;
  console.log(`Attempting to add duplicate room: ${existingRoom}`);

  // Mock request
  const req = {
    body: {
      labId: 1,
      roomNo: existingRoom
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
      console.log('Response Status:', this.statusCode);
      console.log('Response Body:', data);
      process.exit(0);
    }
  };

  const next = (err) => {
    console.error('BACKEND ERROR:', err);
    process.exit(1);
  };

  labController.createRoom(req, res, next);
}

test();
