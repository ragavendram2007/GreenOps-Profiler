# Walkthrough & Demonstration Guide - Nemesis GreenOps Profiler

This guide details steps to reproduce and verify the performance differential between recursive and iterative Fibonacci algorithms using GreenOps telemetry.

## Step 1: Start the API Bridge
Run the local Node.js Express server to handle incoming profiling requests:
```bash
cd bridge
node server.js
```

## Step 2: Trigger Profiling
Execute the test request against the API:
```bash
cd bridge
node test_request.js
```

## Expected Telemetry Outputs:
- **Recursive Fibonacci**: ~1.8 to 2.8 Joules (due to exponential calling overhead).
- **Iterative Fibonacci**: ~0.43 Joules (runs in $O(n)$ time).

Both values demonstrate the baseline idle subtraction and process termination limits.
