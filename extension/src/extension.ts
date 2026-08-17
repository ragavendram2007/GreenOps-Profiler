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
                        displayProfileResults(editor, data, context);
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

function displayProfileResults(editor: vscode.TextEditor, data: any, context: vscode.ExtensionContext) {
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
    showGreenOpsDashboard(data, context);
}

function showGreenOpsDashboard(data: any, context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'greenOpsDashboard',
        'GreenOps Dashboard 🍃',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    const summary = data.summary;
    const itemsHtml = (data.flaggedLines || []).map((item: any) => `
        <div class="card warning">
            <h3>⚠️ Line ${item.line} Hotspot</h3>
            <p><strong>Code:</strong> <code>${item.content}</code></p>
            <p><strong>Energy Draw:</strong> ${item.joules.toFixed(2)} Joules</p>
            <p>${item.reason}</p>
        </div>
    `).join('');

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    padding: 24px;
                    background: #1e1e1e;
                    color: #e0e0e0;
                }
                .header {
                    border-bottom: 2px solid #333;
                    padding-bottom: 12px;
                    margin-bottom: 24px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                    color: #34C759;
                    display: flex;
                    align-items: center;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-bottom: 32px;
                }
                .stat-box {
                    background: #252526;
                    border: 1px solid #3c3c3c;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }
                .stat-box h2 {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    color: #8e8e93;
                    text-transform: uppercase;
                }
                .stat-box p {
                    margin: 0;
                    font-size: 32px;
                    font-weight: bold;
                    color: #fff;
                }
                .card {
                    background: #2d2d2d;
                    border-left: 4px solid #ff453a;
                    padding: 16px;
                    margin-bottom: 16px;
                    border-radius: 4px;
                }
                .card.warning {
                    background: #3a2424;
                }
                .card h3 {
                    margin-top: 0;
                    color: #ff453a;
                }
                code {
                    background: #111;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }
                .footer {
                    font-size: 11px;
                    color: #555;
                    margin-top: 40px;
                    border-top: 1px solid #333;
                    padding-top: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍃 Nemesis GreenOps Profiler</h1>
            </div>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <h2>Total Energy</h2>
                    <p>${summary.total_joules.toFixed(2)} J</p>
                </div>
                <div class="stat-box">
                    <h2>Carbon Footprint</h2>
                    <p>${(summary.gCO2eq * 1000).toFixed(2)} mg</p>
                </div>
                <div class="stat-box">
                    <h2>Duration</h2>
                    <p>${summary.duration_s.toFixed(2)} s</p>
                </div>
            </div>

            <div style="background: #252526; border: 1px solid #3c3c3c; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                <h3 style="margin-top: 0; color: #34C759;">☁️ Cloud Scale Estimator</h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #8e8e93;">Extrapolated daily consumption metrics at scale (10,000 runs/day):</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <strong style="color: #fff; font-size: 16px;">Daily Energy:</strong> ${(summary.scaleEstimate.daily_joules).toFixed(1)} Joules
                    </div>
                    <div>
                        <strong style="color: #fff; font-size: 16px;">Daily Carbon:</strong> ${(summary.scaleEstimate.daily_gCO2eq).toFixed(4)} gCO2eq
                    </div>
                </div>
                <p style="margin: 12px 0 0 0; font-size: 11px; color: #8e8e93; font-style: italic;">*Note: This is an illustrative extrapolation, not a direct measured claim.</p>
            </div>

            <h2>Performance Highlights</h2>
            ${itemsHtml || '<p>🟢 All code regions are executing at efficient baseline levels.</p>'}

            <div class="footer">
                Prototype constructed by Nemesis: Sruthi Gunaseelan, Ragavendra M, Venkataraam VG
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {}
