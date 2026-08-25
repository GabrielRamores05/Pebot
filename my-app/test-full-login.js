const http = require('http');

function makeRequest(method, path, body = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookies && { 'Cookie': cookies }),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({
          status: res.status,
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
          cookies: setCookie,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testLogin() {
  try {
    console.log('\n=== Admin Login Test ===\n');
    
    // Step 1: Login
    console.log('1. Testing login with admin@cafeos.local / admin123...');
    const loginRes = await makeRequest(
      'POST',
      '/api/auth/login',
      { email: 'admin@cafeos.local', password: 'admin123' }
    );
    
    console.log(`   Status: ${loginRes.statusCode}`);
    console.log(`   User: ${loginRes.body?.user?.email} (role: ${loginRes.body?.user?.role})`);
    console.log(`   Token: ${loginRes.body?.token ? 'Present' : 'Missing'}`);
    console.log(`   Set-Cookie: ${loginRes.cookies ? 'Yes' : 'No'}`);
    
    if (loginRes.statusCode !== 200) {
      console.log('❌ Login failed!');
      return;
    }
    
    // Extract the token from Set-Cookie
    const setCookieHeader = loginRes.cookies ? loginRes.cookies[0] : '';
    const tokenFromCookie = setCookieHeader.match(/cafeos-token=([^;]+)/)?.[1];
    console.log(`   Cookie token: ${tokenFromCookie ? 'Found' : 'Not found'}`);
    
    if (!tokenFromCookie) {
      console.log('❌ No token cookie found!');
      return;
    }
    
    // Step 2: Test /admin access with token
    console.log('\n2. Testing /admin access with token...');
    const adminRes = await makeRequest(
      'GET',
      '/admin',
      null,
      `cafeos-token=${tokenFromCookie}`
    );
    
    console.log(`   Status: ${adminRes.statusCode}`);
    if (adminRes.statusCode === 307 || adminRes.statusCode === 308) {
      console.log(`   Redirect location: ${adminRes.headers.location || 'None'}`);
      console.log(`   ✅ Successfully authenticated and accessed /admin`);
    } else {
      console.log(`   Body: ${adminRes.body ? JSON.stringify(adminRes.body) : 'No body'}`);
      console.log(`   ❌ Unexpected status`);
    }
    
    // Step 3: Test /admin without token (should redirect to login)
    console.log('\n3. Testing /admin without token (should redirect to /login)...');
    const noTokenRes = await makeRequest(
      'GET',
      '/admin'
    );
    
    console.log(`   Status: ${noTokenRes.statusCode}`);
    console.log(`   Redirect location: ${noTokenRes.headers.location || 'None'}`);
    if (noTokenRes.headers.location?.includes('/login')) {
      console.log(`   ✅ Correctly redirected to /login`);
    } else {
      console.log(`   ❌ Did not redirect to login`);
    }
    
    console.log('\n=== Test Complete ===\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
