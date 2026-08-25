const fetch = require('node-fetch');

(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cafeos.local', password: 'admin123' })
  });
  
  const logResponse = await login.json();
console.log('Login Response:', logResponse);
  
  const headers = new fetch.Headers();
  headers.append('Cookie', `cafeos-token=${logResponse.token}`);
  
  const auth = await fetch('http://localhost:3000/admin', { redirect: 'manual', headers });
  console.log('/admin Status:', auth.status);
  console.log('/admin Location Header:', auth.headers.get('location'));
})();
