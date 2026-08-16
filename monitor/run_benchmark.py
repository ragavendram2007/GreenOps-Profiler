import subprocess
import time
import json
import statistics
import sys
import os

def run_profile(script_name):
    # Start target script in background
    cmd_script = [sys.executable, os.path.join("tests", script_name)]
    proc_script = subprocess.Popen(cmd_script, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Start monitor targeting the script PID
    cmd_mon = [
        os.path.join(".", "greenops-monitor.exe"),
        "--pid", str(proc_script.pid),
        "--interval", "50"
    ]
    
    proc_mon = subprocess.Popen(cmd_mon, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    # Wait for target script to complete
    proc_script.wait()
    
    # Let monitor capture last frames and terminate
    stdout_mon, stderr_mon = proc_mon.communicate()
    
    # Parse final summary joules
    joules = 0.0
    for line in stdout_mon.splitlines():
        if "summary" in line:
            try:
                data = json.loads(line)
                joules = data["summary"]["total_joules"]
            except Exception as e:
                pass
    return joules

if __name__ == "__main__":
    print("Starting multi-run averaging benchmark (Nemesis Team Phase 1)...")
    
    recursive_runs = []
    iterative_runs = []
    
    for i in range(4):
        print(f"Run {i+1}/4 - Recursive...")
        j = run_profile("fib_recursive.py")
        recursive_runs.append(j)
        time.sleep(1)
        
    for i in range(4):
        print(f"Run {i+1}/4 - Iterative...")
        j = run_profile("fib_iterative.py")
        iterative_runs.append(j)
        time.sleep(1)

    # Discard warm-up run (1st run)
    rec_filtered = recursive_runs[1:]
    iter_filtered = iterative_runs[1:]

    mean_rec = statistics.mean(rec_filtered)
    std_rec = statistics.stdev(rec_filtered) if len(rec_filtered) > 1 else 0
    
    mean_iter = statistics.mean(iter_filtered)
    std_iter = statistics.stdev(iter_filtered) if len(iter_filtered) > 1 else 0

    print("\n--- BENCHMARK RESULTS ---")
    print(f"Recursive: Mean = {mean_rec:.3f} J, StdDev = {std_rec:.3f} J (Raw: {recursive_runs})")
    print(f"Iterative: Mean = {mean_iter:.3f} J, StdDev = {std_iter:.3f} J (Raw: {iterative_runs})")
    print(f"Delta: {mean_rec - mean_iter:.3f} Joules savings achieved by Nemesis Profiler telemetry")
