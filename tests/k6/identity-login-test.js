import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { parseHTML } from 'k6/html';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const logoutSuccessRate = new Rate('logout_success_rate');
const sessionDuration = new Trend('session_duration');
const loginAttempts = new Counter('login_attempts');
const logoutAttempts = new Counter('logout_attempts');

// Configuration
export const options = {
  // Test scenarios
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      startTime: '30s', // Start after the constant load scenario
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests should be below 1s
    'login_success_rate': ['rate>0.9'],  // 90% of logins should succeed
    'logout_success_rate': ['rate>0.95'], // 95% of logouts should succeed
  },
};

// Helper function to generate users with standard passwords
function generateUser(prefix, index) {
  const username = `${prefix}${index}`;
  const password = 'Pass123$'; // All users use the same password
  return { username, password };
}

// User pool - including all available users from UsersSeed.cs
const users = [
  { username: 'alice', password: 'Pass123$' },
  { username: 'bob', password: 'Pass123$' },
  { username: 'demouser', password: 'Pass123$' },
];

// Add the additional 18 test users
const prefixes = ['test', 'user', 'customer', 'employee', 'guest', 'member'];
for (let i = 1; i <= 18; i++) {
  const prefixIndex = (i - 1) % prefixes.length;
  users.push(generateUser(prefixes[prefixIndex], i));
}

// Initial setup - executed once per VU
export function setup() {
  console.log(`Starting login/logout performance test with ${users.length} users`);
  return {
    baseUrl: __ENV.BASE_URL || 'https://localhost:5243', // Identity API URL
    clientId: 'mvc',
    returnUrl: 'https://localhost:7298/' // WebMVC client URL
  };
}

// Main test function - executed for each virtual user
export default function(data) {
  const baseUrl = data.baseUrl;
  
  // Select a random user from the pool
  const userIndex = randomIntBetween(0, users.length - 1);
  const user = users[userIndex];
  
  const startTime = new Date().getTime();
  
  group('Login Flow', function() {
    // Step 1: Get the login page (to obtain anti-forgery token)
    const loginPageUrl = `${baseUrl}/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Frequest_uri%3Durn%253Aietf%253Aparams%253Aoauth%253Arequest_uri%253ABE134562283FC4A15DD7B127A6BF30474811752E0DE10521CCD766C16BDCEAE2%26client_id%3Dwebapp`;
    const loginPageResponse = http.get(loginPageUrl, {
        headers: { 'User-Agent': 'k6' }
    });

    console.log(`Login page response: ${loginPageResponse.status}`);
    console.log(`Response body: ${loginPageResponse.body ? loginPageResponse.body.substring(0, 500) : 'No body received'}`);
    
    check(loginPageResponse, {
      'login page loaded': (r) => r.status === 200,
      'login form exists': (r) => r.body.includes('form')
    });
    
    // Extract the anti-forgery token
    const doc = parseHTML(loginPageResponse.body);
    const requestVerificationToken = doc.find('input[name="__RequestVerificationToken"]').attr('value');
    const returnUrl = doc.find('input[name="ReturnUrl"]').attr('value') || data.returnUrl;
    
    if (!requestVerificationToken) {
      console.error('Failed to extract anti-forgery token from login page');
      loginSuccessRate.add(0);
      return;
    }
    
    // Short pause to simulate user entering credentials
    sleep(randomIntBetween(1, 3));
    
    // Step 2: Submit login form
    loginAttempts.add(1);
    const loginPayload = {
      Username: user.username,
      Password: user.password,
      RememberLogin: false,
      ReturnUrl: returnUrl,
      __RequestVerificationToken: requestVerificationToken,
      button: 'login'
    };
    
    const loginResponse = http.post(loginPageUrl, loginPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'Cookie': loginPageResponse.cookies.toString()
      }
    });
    
    const loginSuccess = check(loginResponse, {
      'login successful': (r) => r.status === 302 || r.status === 200
    });
    
    loginSuccessRate.add(loginSuccess);
    
    if (!loginSuccess) {
      console.error(`Login failed for user ${user.username}`);
      return;
    }
    
    // Simulate user activity after login
    sleep(randomIntBetween(3, 8));
    
    // Step 3: Access the logout endpoint
    const logoutPageUrl = `${baseUrl}/Account/Logout`;
    const logoutPageResponse = http.get(logoutPageUrl, {
      headers: {
        'Accept': 'text/html',
        'Cookie': loginResponse.cookies.toString()
      }
    });
    
    // Check if the logout was successful with the GET request
    const directLogoutSuccess = check(logoutPageResponse, {
      'logout page loaded': (r) => r.status === 200 || r.status === 302
    });
    
    // If the page contains a form, it might be a confirmation page
    const hasLogoutForm = logoutPageResponse.body.includes('form');
    logoutAttempts.add(1);
    
    let logoutSuccess = directLogoutSuccess;
    
    // Only try to submit the form if one exists
    if (hasLogoutForm) {
      console.log('Logout form found, submitting confirmation...');
      // Extract any tokens from the form
      const logoutDoc = parseHTML(logoutPageResponse.body);
      const logoutToken = logoutDoc.find('input[name="__RequestVerificationToken"]').attr('value');
      const logoutId = logoutDoc.find('input[name="LogoutId"]').attr('value');
      
      // Short pause to simulate user confirming logout
      sleep(randomIntBetween(1, 2));
      
      // Only submit the form if we found the necessary tokens
      if (logoutToken && logoutId) {
        const logoutPayload = {
          LogoutId: logoutId,
          __RequestVerificationToken: logoutToken
        };
        
        const logoutResponse = http.post(logoutPageUrl, logoutPayload, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html',
            'Cookie': loginResponse.cookies.toString() + '; ' + logoutPageResponse.cookies.toString()
          }
        });
        
        logoutSuccess = check(logoutResponse, {
          'logout form submission successful': (r) => r.status === 200 || r.status === 302
        });
      } else {
        console.log('Could not find necessary tokens for logout form submission');
      }
    } else {
      console.log('No logout form found, assuming direct logout');
    }
    
    logoutSuccessRate.add(logoutSuccess);
    
    // Record session duration
    const endTime = new Date().getTime();
    const duration = (endTime - startTime) / 1000; // Duration in seconds
    sessionDuration.add(duration);
  });
  
  // Wait between iterations
  sleep(randomIntBetween(1, 5));
}

// Cleanup - executed once at the end of the test
export function teardown(data) {
  console.log('Login/logout performance test completed');
}
