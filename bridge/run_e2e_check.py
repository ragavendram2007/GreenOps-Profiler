import http
import json
import urllib.request
import os

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
            return json.loads(response.read().decode())
    except Exception as e:
        return {"error": str(e)}

print("RECURSIVE RUN:")
print(json.dumps(call_bridge("../monitor/tests/fib_recursive.py"), indent=2))
print("\nITERATIVE RUN:")
print(json.dumps(call_bridge("../monitor/tests/fib_iterative.py"), indent=2))
