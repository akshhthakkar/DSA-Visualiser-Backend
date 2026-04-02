import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // simulate ramp-up of traffic from 1 to 20 users over 30 seconds.
    { duration: '1m', target: 20 }, // stay at 20 users for 1 minute
    { duration: '30s', target: 0 }, // ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // 99% of requests must complete below 500ms
  },
};

export default function () {
  const url = 'http://localhost:3000/api/auth/login';
  const payload = JSON.stringify({
    email: 'admin@test.edu',
    password: 'password123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  });

  sleep(1);
}
