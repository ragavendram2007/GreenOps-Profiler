import sys
import time

def fib_iterative(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == "__main__":
    n = 35
    print(f"Calculating iterative fibonacci({n})...")
    start = time.time()
    # Run in a loop to match recursive execution time slightly or just run it instantly to show the performance delta.
    # To make it run for a brief moment, we can do it many times.
    for _ in range(10000):
        result = fib_iterative(n)
    end = time.time()
    print(f"Result: {result} in {end - start:.4f}s")
