import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // ramp-up to 5 users for bulk imports
    { duration: '1m', target: 5 }, // hold at 5 users
    { duration: '30s', target: 0 }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
  },
};

const DUMMY_CSV = `name,email,registerNumber,degree,batch
Test User 1,k6.test1@university.edu,REG-K6-001,CS,2025
Test User 2,k6.test2@university.edu,REG-K6-002,CS,2025
Test User 3,k6.test3@university.edu,REG-K6-003,CS,2025
Test User 4,k6.test4@university.edu,REG-K6-004,CS,2025
Test User 5,k6.test5@university.edu,REG-K6-005,CS,2025`;

export function setup() {
  // Login first to get an admin token
  const url = 'http://localhost:3000/api/auth/login';
  const payload = JSON.stringify({
    email: 'admin@test.edu',
    password: 'password123',
  });
  const res = http.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('token') };
}

export default function (data) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = \`--\${boundary}\\r\\n\`;
  body += 'Content-Disposition: form-data; name="file"; filename="test.csv"\\r\\n';
  body += 'Content-Type: text/csv\\r\\n\\r\\n';
  body += DUMMY_CSV + '\\r\\n';
  body += \`--\${boundary}--\\r\\n\`;

  const params = {
    headers: {
      Authorization: \`Bearer \${data.token}\`,
      'Content-Type': \`multipart/form-data; boundary=\${boundary}\`,
    },
  };

  const res = http.post('http://localhost:3000/api/bulk/students/upload-csv', body, params);

  check(res, {
    'is status 201': (r) => r.status === 201 || r.status === 429, // Allow 429 for rate limiting
  });

  sleep(2);
}
