const http = require('http');

// Test updating staff permissions only (no password change)
const updateData = {
  permissions: {
    liveOrders: true,
    terminal: true,
    tables: true,
    analytics: true,
    products: true,
    inventory: true,
    kitchen: true,
    loyalty: true,
    staff: true,
    settings: true,
  }
};

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/staff/2', // staff user ID
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': JSON.stringify(updateData).length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

console.log('Sending update request...');
req.write(JSON.stringify(updateData));
req.end();
