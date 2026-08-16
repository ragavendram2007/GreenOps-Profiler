cmake_minimum_required(VERSION 3.10)
project(greenops-monitor CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add source files
add_executable(greenops-monitor monitor.cpp)

# Link threads if needed (for cross-platform timers)
find_package(Threads REQUIRED)
target_link_libraries(greenops-monitor PRIVATE Threads::Threads)
