import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';

// Custom decoration types with clean premium CSS highlights
const redLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    border: '1px dashed rgba(255, 69, 58, 0.4)',
    overviewRulerColor: 'rgba(255, 69, 58, 0.8)',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    isWholeLine: true
});

const greenLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    border: '1px solid rgba(52, 199, 89, 0.25)',
    isWholeLine: true
});

export function activate(context: vscode.ExtensionContext) {
    console.log('GreenOps Premium Extension activated!');

    // Track profiled runs across the session for comparison (Joule value and script name)
    const sessionHistory: { script: string, joules: number }[] = [];

    // Initialize custom status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'greenops-profiler.profile';
    statusBarItem.text = '$(leaf) Profile Energy';
    statusBarItem.tooltip = 'Click to run GreenOps Energy Profiler';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let disposable = vscode.commands.registerCommand('greenops-profiler.profile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor open to profile!');
            return;
        }

        const scriptPath = editor.document.fileName;
        statusBarItem.text = '$(sync~spin) Profiling...';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

        // Request body
        const postData = JSON.stringify({ scriptPath });

        const options = {
            hostname: 'localhost',
            port: 4200,
            path: '/profile',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                statusBarItem.text = '$(leaf) Profile Energy';
                statusBarItem.backgroundColor = undefined;
                try {
                    const data = JSON.parse(body);
                    if (data.success) {
                        // Store in comparison history
                        sessionHistory.push({
                            script: path.basename(data.script || editor.document.fileName),
                            joules: data.summary.total_joules
                        });
                        displayProfileResults(editor, data, sessionHistory, context);
                    } else {
                        vscode.window.showErrorMessage(`Profile execution failed: ${data.error}`);
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Error parsing profile response: ${err.message}`);
                }
            });
        });

        req.on('error', (err) => {
            statusBarItem.text = '$(leaf) Profile Energy';
            statusBarItem.backgroundColor = undefined;
            vscode.window.showErrorMessage(`Failed to connect to GreenOps Bridge: ${err.message}. Ensure bridge is running on port 4200`);
        });

        req.write(postData);
        req.end();
    });

    context.subscriptions.push(disposable);
}

function displayProfileResults(editor: vscode.TextEditor, data: any, sessionHistory: any[], context: vscode.ExtensionContext) {
    const summary = data.summary;
    const flagged = data.flaggedLines || [];
    
    // Status Bar summary details
    vscode.window.showInformationMessage(
        `🍃 GreenOps: ${summary.total_joules.toFixed(2)} Joules (${(summary.gCO2eq * 1000).toFixed(2)} mgCO2eq) | Duration: ${summary.duration_s.toFixed(2)}s`
    );

    const redDecorations: vscode.DecorationOptions[] = [];
    const greenDecorations: vscode.DecorationOptions[] = [];

    // Flag red hotspots
    flagged.forEach((item: any) => {
        const lineIndex = item.line - 1;
        if (lineIndex >= 0 && lineIndex < editor.document.lineCount) {
            const lineRange = editor.document.lineAt(lineIndex).range;
            redDecorations.push({
                range: lineRange,
                hoverMessage: new vscode.MarkdownString(
                    `### 🍃 Nemesis GreenOps Telemetry\n` +
                    `#### ⚠️ Hotspot Detected: Line ${item.line}\n` +
                    `* **Marginal Power Cost**: ${item.joules.toFixed(2)} Joules\n` +
                    `* **Total footprint**: ${((item.joules / summary.total_joules) * 100).toFixed(0)}% of run\n\n` +
                    `**Recommendation**: ${item.reason}`
                )
            });
        }
    });

    // Populate remaining lines as green (efficient baseline)
    const flaggedLinesSet = new Set(flagged.map((i: any) => i.line - 1));
    for (let i = 0; i < editor.document.lineCount; i++) {
        if (!flaggedLinesSet.has(i) && editor.document.lineAt(i).text.trim().length > 0) {
            const lineRange = editor.document.lineAt(i).range;
            greenDecorations.push({
                range: lineRange,
                hoverMessage: new vscode.MarkdownString(`🟢 **GreenOps Clean Code**: Negligible marginal resource footprint.`)
            });
        }
    }

    editor.setDecorations(redLineDecoration, redDecorations);
    editor.setDecorations(greenLineDecoration, greenDecorations);

    // Show a Webview Dashboard Panel with rich UI
    showGreenOpsDashboard(data, sessionHistory, context);
}

function showGreenOpsDashboard(data: any, sessionHistory: any[], context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'greenOpsDashboard',
        'GreenOps Dashboard 🍃',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    // Click-to-jump messaging listener
    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'jumpToLine') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const line = message.line - 1;
                const range = editor.document.lineAt(line).range;
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        }
    }, undefined, context.subscriptions);

    const summary = data.summary;
    const itemsHtml = (data.flaggedLines || []).map((item: any) => `
        <div class="card warning" tabindex="0" onclick="vscode.postMessage({command: 'jumpToLine', line: ${item.line}})" style="cursor: pointer; position: relative; overflow: hidden;">
            <div style="font-size: 11px; text-transform: uppercase; color: #ff453a; margin-bottom: 6px; font-weight: bold;">⚠️ Hotspot Line ${item.line}</div>
            <code style="display: block; background: #080808; border: 1px solid #2a2c2e; padding: 6px 10px; border-radius: 4px; color: #ff453a; font-family: monospace; font-size: 13px;">${item.content}</code>
            <div class="hover-details" style="margin-top: 8px; font-size: 13px; color: #8e8e93; line-height: 1.4;">
                <strong>Telemetry Draw:</strong> <span style="color: #fff;">${item.joules.toFixed(2)} J</span><br/>
                ${item.reason}
            </div>
        </div>
    `).join('');

    // Generate comparison bars
    const maxJoules = Math.max(...sessionHistory.map(h => h.joules), 0.05);
    const comparisonHtml = sessionHistory.map(h => {
        const percent = Math.max((h.joules / maxJoules) * 100, 3);
        const color = h.joules > 0.5 ? '#ff453a' : '#34C759';
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                    <span style="color: #e0e0e0; font-family: monospace;">${h.script}</span>
                    <strong style="color: ${color};">${h.joules.toFixed(3)} J</strong>
                </div>
                <div style="background: #1a1a1a; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: ${color}; width: ${percent}%; height: 100%; transition: width 0.8s ease-out;"></div>
                </div>
            </div>
        `;
    }).join('');

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                    padding: 24px;
                    background: #0d0f11;
                    color: #d1d5db;
                }
                .header {
                    border-bottom: 2px solid #1e293b;
                    padding-bottom: 18px;
                    margin-bottom: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                    color: #38bdf8;
                    font-family: monospace;
                    letter-spacing: 2px;
                    text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
                }
                .badge {
                    background: rgba(30, 41, 59, 0.5);
                    border: 1px solid #334155;
                    border-radius: 9999px;
                    padding: 4px 12px;
                    font-size: 9px;
                    color: #94a3b8;
                    font-weight: 600;
                    letter-spacing: 1px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 20px;
                    margin-bottom: 28px;
                }
                .stat-box {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
                    transition: transform 0.2s, border-color 0.2s;
                }
                .stat-box:hover {
                    transform: translateY(-2px);
                    border-color: #38bdf8;
                }
                .stat-box h2 {
                    margin: 0 0 8px 0;
                    font-size: 10px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 700;
                }
                .stat-box p {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 800;
                    color: #f8fafc;
                    font-family: monospace;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                .card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-left: 5px solid #ef4444;
                    padding: 16px;
                    margin-bottom: 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .card:hover, .card:focus {
                    border-color: #ef4444;
                    background: #272125;
                    transform: translateX(4px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                    outline: none;
                }
                .footer {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 48px;
                    border-top: 1px solid #1e293b;
                    padding-top: 16px;
                    display: flex;
                    justify-content: space-between;
                }
                .wave-pulse {
                    height: 3px;
                    background: linear-gradient(90deg, transparent, #38bdf8, transparent);
                    animation: pulse 3s infinite linear;
                    margin-bottom: 28px;
                    border-radius: 9999px;
                }
                @keyframes pulse {
                    0% { background-position: -200px 0; }
                    100% { background-position: 400px 0; }
                }
            </style>
        </head>
        <body>
            <script>
                const vscode = acquireVsCodeApi();
                
                function animateValue(id, start, end, duration, decimals = 2) {
                    const obj = document.getElementById(id);
                    let startTimestamp = null;
                    const step = (timestamp) => {
                        if (!startTimestamp) startTimestamp = timestamp;
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                        obj.innerHTML = (progress * (end - start) + start).toFixed(decimals);
                        if (progress < 1) {
                            window.requestAnimationFrame(step);
                        }
                    };
                    window.requestAnimationFrame(step);
                }
                
                window.onload = () => {
                    animateValue('energy-val', 0, ${summary.total_joules}, 600, 2);
                    animateValue('carbon-val', 0, ${summary.gCO2eq * 1000}, 600, 2);
                    animateValue('duration-val', 0, ${summary.duration_s}, 600, 2);
                };
            </script>
            <div class="header">
                <h1>🍃 GREENOPS TELEMETRY PANEL</h1>
                <div class="badge">SIMULATION MODE ACTIVE</div>
            </div>
            
            <div class="wave-pulse"></div>
            
            <div class="stats-grid">
                <div class="stat-box" style="border-bottom: 3px solid #38bdf8;">
                    <h2>Total Energy</h2>
                    <p><span id="energy-val">0.00</span> J</p>
                </div>
                <div class="stat-box" style="border-bottom: 3px solid #10b981;">
                    <h2>Carbon Footprint</h2>
                    <p><span id="carbon-val">0.00</span> mg</p>
                </div>
                <div class="stat-box" style="border-bottom: 3px solid #e2e8f0;">
                    <h2>Duration</h2>
                    <p><span id="duration-val">0.00</span> s</p>
                </div>
            </div>

            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
                <h3 style="margin-top: 0; color: #38bdf8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; font-weight: 700;">☁️ Cloud Scale Estimator</h3>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8;">Extrapolated daily consumption metrics at scale (10,000 runs/day):</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-family: monospace;">
                    <div>
                        <strong style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Daily Energy</strong><br/>
                        <span style="color: #f8fafc; font-size: 18px; font-weight: 700;">${(summary.scaleEstimate.daily_joules).toFixed(1)} J</span>
                    </div>
                    <div>
                        <strong style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Daily Carbon</strong><br/>
                        <span style="color: #f8fafc; font-size: 18px; font-weight: 700;">${(summary.scaleEstimate.daily_gCO2eq).toFixed(4)} g</span>
                    </div>
                </div>
                <p style="margin: 14px 0 0 0; font-size: 9px; color: #64748b; font-style: italic;">*Note: This is an illustrative extrapolation, not a direct measured claim.</p>
            </div>

            ${sessionHistory.length > 1 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
                <h3 style="margin-top: 0; color: #38bdf8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-family: monospace; font-weight: 700;">📊 Run Comparison History</h3>
                ${comparisonHtml}
            </div>
            ` : ''}

            <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin: 28px 0 16px 0;">Performance Highlights</h2>
            ${itemsHtml || '<p style="color: #10b981; font-weight: 600; font-size: 14px;">🟢 All code regions are executing at efficient baseline levels.</p>'}

            <div class="footer">
                <div>Nemesis Team Dashboard</div>
                <div>Sruthi Gunaseelan, Ragavendra M, Venkataraam VG</div>
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {}
