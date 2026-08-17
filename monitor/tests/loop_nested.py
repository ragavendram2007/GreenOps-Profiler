# Test script with nested loops to trigger vectorization rules
import time

def compute_nested_totals():
    # Hotspot detection should flag nested loops that perform repetitive calculations
    # Suggest vectorizing using NumPy or using list comprehensions
    total = 0
    matrix = [[i for i in range(100)] for _ in range(100)]
    for i in range(len(matrix)):
        for j in range(len(matrix[i])):
            total += matrix[i][j]
    return total

if __name__ == "__main__":
    print("Running loop optimization candidates...")
    start = time.time()
    for _ in range(20000):
        res = compute_nested_totals()
    end = time.time()
    print(f"Computed total: {res} in {end - start:.4f}s")
