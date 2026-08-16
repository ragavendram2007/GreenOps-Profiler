import http
import json
import urllib.request
import os
import time

def call_bridge(script):
    data = json.dumps({
        "scriptPath": os.path.abspath(script)
    }).encode('utf-8')
    req = urllib.request.Request(
        "http://localhost:4200/profile", 
        data=data, 
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            return res["summary"]["total_joules"]
    except Exception as e:
        return str(e)

print("Starting multi-run check...")
for i in range(3):
    j_rec = call_bridge("../monitor/tests/fib_recursive.py")
    print(f"Recursive Run {i+1}: {j_rec} J")
    time.sleep(1)

for i in range(3):
    j_iter = call_bridge("../monitor/tests/fib_iterative.py")
    print(f"Iterative Run {i+1}: {j_iter} J")
    time.sleep(1)
