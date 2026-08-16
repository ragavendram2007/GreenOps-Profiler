import sys
import time

def fib_recursive(n):
    if n <= 1:
        return n
    return fib_recursive(n - 1) + fib_recursive(n - 2)

if __name__ == "__main__":
    n = 35
    print(f"Calculating recursive fibonacci({n})...")
    start = time.time()
    result = fib_recursive(n)
    end = time.time()
    print(f"Result: {result} in {end - start:.4f}s")
