import http from 'http';

const data = JSON.stringify({
    scriptPath: 'C:\\Users\\Ragavendra M\\.gemini\\antigravity\\scratch\\greenops-profiler\\monitor\\tests\\fib_recursive.py'
});

const options = {
    hostname: 'localhost',
    port: 4200,
    path: '/profile',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log("RESPONSE RECEIVED:\n", JSON.stringify(JSON.parse(body), null, 2));
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`Request failed: ${e.message}`);
    process.exit(1);
});

req.write(data);
req.end();
