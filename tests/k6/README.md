# Login/Logout Performance Testing with k6

This directory contains scripts for load testing the eShop Identity API login and logout functionality using [k6](https://k6.io/).

## Setup

1. Install k6: https://k6.io/docs/getting-started/installation/

## Running the tests

### Basic Usage

```bash
k6 run identity-login-test.js
```

### Custom Configuration

You can customize the test by setting environment variables:

```bash
k6 run --env BASE_URL=http://localhost:5105 identity-login-test.js
```

## Test Scenarios

The test script includes two scenarios:

1. **Constant Load**: 10 virtual users for 30 seconds
2. **Ramp Up**: Starting with 0 users, ramping up to 20 users, then back down to 0

## Available Test Users

The load test uses 21 test users:

1. Original users:
   - alice/Pass123$
   - bob/Pass123$
   

2. Additional users (created in UsersSeed.cs):
   - demouser/Pass123$
   - test1/Pass123$
   - user2/Pass123$
   - customer3/Pass123$
   - employee4/Pass123$
   - ...and so on

All these users are automatically created when the application starts through the UsersSeed.cs seeding logic.

## Metrics Collected

- **Standard k6 metrics**: http_req_duration, iterations, etc.
- **Custom metrics**:
  - `login_success_rate`: Percentage of successful login attempts
  - `logout_success_rate`: Percentage of successful logout attempts
  - `session_duration`: Distribution of session durations (time between login and logout)
  - `login_attempts`: Total number of login attempts
  - `logout_attempts`: Total number of logout attempts

## Integration with Grafana

You can visualize k6 results in Grafana by:

1. Running k6 with InfluxDB output:
   ```
   k6 run --out influxdb=http://localhost:8086/k6 identity-login-test.js
   ```
2. Creating a Grafana dashboard that uses InfluxDB as a data source
