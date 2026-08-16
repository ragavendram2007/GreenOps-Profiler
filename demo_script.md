# Walkthrough & Demonstration Guide - Nemesis GreenOps Profiler

This guide details steps to reproduce and verify the performance differential between recursive and iterative Fibonacci algorithms using GreenOps telemetry.

## Step 1: Start the API Bridge
Run the local Node.js Express server to handle incoming profiling requests:
```bash
cd bridge
node server.js
```

## Step 2: Verify Bridge Status
Verify the server is up and listening on port 4200:
```bash
curl -I http://localhost:4200/
```
Expected HTTP output status is `200 OK` or `404 Not Found` (root route is unregistered).

## Step 3: Trigger Profiling
Execute the verification check endpoint:
```bash
python run_e2e_check.py
```

### Expected Telemetry Outputs:
- **Recursive Fibonacci (`fib_recursive.py`)**: ~2.6 to 2.9 Joules.
- **Iterative Fibonacci (`fib_iterative.py`)**: ~0.05 Joules (identified as `below sampling resolution, value is a floor estimate`).

## Step 4: Live VS Code Demo
1. Ensure the VSIX extension bundle is installed.
2. Open `fib_recursive.py` and click the Leaf Icon. Lines 4, 7, and 13 will highlight in Red.
3. Open `fib_iterative.py` and click the Leaf Icon. All lines will highlight in Green, presenting the resolution floor estimate warning in the status dashboard.
