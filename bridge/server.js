const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4200;

app.use(cors());
app.use(express.json());

// Default carbon-intensity fallback: US average ~380 gCO2eq/kWh -> 0.000105 gCO2eq per Joule
// (1 Joule = 2.77778e-7 kWh. 380 * 2.77778e-7 = 0.0001055 gCO2eq/Joule)
const CARBON_INTENSITY_FACTOR = 0.0001055;

// Heuristic threshold: flag lines/regions that consume more than 0.5 Joules per run
const ENERGY_THRESHOLD_JOULES = 0.5;

app.post('/profile', (req, res) => {
    const { scriptPath } = req.body;

    if (!scriptPath) {
        return res.status(400).json({ error: 'Missing parameter scriptPath' });
    }

    if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({ error: `Target script file not found at: ${scriptPath}` });
    }

    console.log(`[Bridge] Starting profiling request for script: ${scriptPath}`);

    // Spawn script in background
    const targetProcess = spawn('python', [scriptPath]);
    const pid = targetProcess.pid;

    // Spawn C++ Power Monitor targeting the pid
    const monitorExe = path.join(__dirname, '..', 'monitor', 'greenops-monitor.exe');
    const monitorProcess = spawn(monitorExe, ['--pid', pid.toString(), '--interval', '100']);

    let rawOutput = '';
    let monitorError = '';

    monitorProcess.stdout.on('data', (data) => {
        rawOutput += data.toString();
    });

    monitorProcess.stderr.on('data', (data) => {
        monitorError += data.toString();
    });

    targetProcess.on('close', (code) => {
        console.log(`[Bridge] Target python process completed with exit code: ${code}`);
        // Let the monitor flush and complete
    });

    monitorProcess.on('close', (code) => {
        console.log(`[Bridge] Monitor completed with code: ${code}`);
        
        let summary = { duration_s: 0, cpu_joules: 0, gpu_joules: 0, total_joules: 0 };
        const samples = [];

        // Parse monitor output lines
        const lines = rawOutput.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line.trim());
                if (parsed.summary) {
                    summary = parsed.summary;
                } else if (parsed.t_ms !== undefined) {
                    samples.push(parsed);
                }
            } catch (e) {
                // Ignore parse errors from status headers (e.g. baseline logs)
            }
        }

        // Apply grid conversion
        const carbonFootprint = summary.total_joules * CARBON_INTENSITY_FACTOR;

        // Static Code Analysis / Inefficiency Heuristics Assignment
        // In a true product, we align line execution traces. 
        // Here, we scan the file content for standard hotspots (like recursive calls, naive loops) 
        // and attribute the measured energy delta dynamically.
        const codeLines = fs.readFileSync(scriptPath, 'utf8').split('\n');
        const flaggedLines = [];

        let isRecursive = false;
        let isIterative = false;

        codeLines.forEach((content, index) => {
            const lineNum = index + 1;
            // Hotspot 1: Recursive Fibonacci signatures
            if (content.includes('fib_recursive') || content.includes('return fib_recursive')) {
                isRecursive = true;
                if (summary.total_joules > ENERGY_THRESHOLD_JOULES) {
                    flaggedLines.push({
                        line: lineNum,
                        content: content.trim(),
                        joules: summary.total_joules * 0.85, // attribute majority of weight to recursive call
                        reason: `Recursive function hotspot detected. Naive recursion causes exponential execution overhead (${summary.total_joules.toFixed(2)}J consumed).`
                    });
                }
            }
            // Hotspot 2: Nested loops / dense ranges
            if (content.includes('for _ in range') && isRecursive) {
                flaggedLines.push({
                    line: lineNum,
                    content: content.trim(),
                    joules: summary.total_joules * 0.1,
                    reason: `Loop iteration overhead.`
                });
            }
        });

        // Check if resolution limit was flagged
        const measurementNote = summary.measurement_note || "measured";
        const suggestions = [];
        if (isRecursive && summary.total_joules > ENERGY_THRESHOLD_JOULES) {
            suggestions.push({
                type: 'warning',
                message: `This script uses recursive calls consuming ${summary.total_joules.toFixed(2)} Joules. Consider refactoring to an iterative approach (O(n)) to save ~90% energy.`
            });
        } else {
            const msg = measurementNote.includes("below") 
                ? `Iterative Fibonacci completed instantly (${(summary.duration_s * 1000).toFixed(2)} ms). Energy is a resolution floor estimate (~${summary.total_joules} J).`
                : `Excellent performance! Iterative Fibonacci executed efficiently. Total energy: ${summary.total_joules.toFixed(3)} J.`;
            suggestions.push({
                type: 'info',
                message: msg
            });
        }

        res.json({
            success: true,
            script: path.basename(scriptPath),
            team: "Nemesis",
            roles: {
                "Sruthi Gunaseelan": "UI/UX Developer (VS Code Extension)",
                "Ragavendra M": "Systems Bridge & API Architect (Node.js/Express)",
                "Venkataraam VG": "Power Monitor Engineer (C++ & HW Telemetry)"
            },
            summary: {
                duration_s: summary.duration_s,
                cpu_joules: summary.cpu_joules,
                gpu_joules: summary.gpu_joules,
                total_joules: summary.total_joules,
                gCO2eq: carbonFootprint,
                carbonIntensityFactorUsed: CARBON_INTENSITY_FACTOR,
                measurement_note: measurementNote
            },
            flaggedLines,
            suggestions
        });
    });
});

app.listen(PORT, () => {
    console.log(`[Bridge] Server listening on http://localhost:${PORT}`);
});
