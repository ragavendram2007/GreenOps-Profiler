import * as vscode from 'vscode';
import * as http from 'http';

// Define decoration styles
const redLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
    gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23FF3B30"/></svg>'),
    gutterIconSize: 'contain',
    isWholeLine: true
});

const greenLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%2334C759"/></svg>'),
    gutterIconSize: 'contain',
    isWholeLine: true
});

export function activate(context: vscode.ExtensionContext) {
    console.log('GreenOps Profiler VS Code Extension activated!');

    let disposable = vscode.commands.registerCommand('greenops-profiler.profile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor open to profile!');
            return;
        }

        const scriptPath = editor.document.fileName;
        vscode.window.showInformationMessage(`Nemesis GreenOps: Profiling active script [${vscode.Uri.file(scriptPath).path.split('/').pop()}]...`);

        // Perform request to Local Node Express Bridge
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
                try {
                    const data = JSON.parse(body);
                    if (data.success) {
                        displayProfileResults(editor, data);
                    } else {
                        vscode.window.showErrorMessage(`Profile execution failed: ${data.error}`);
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Error parsing profile response: ${err.message}`);
                }
            });
        });

        req.on('error', (err) => {
            vscode.window.showErrorMessage(`Failed to connect to GreenOps Bridge: ${err.message}. Ensure express server is running on http://localhost:4200`);
        });

        req.write(postData);
        req.end();
    });

    context.subscriptions.push(disposable);
}

function displayProfileResults(editor: vscode.TextEditor, data: any) {
    const summary = data.summary;
    const flagged = data.flaggedLines || [];
    
    // Status Bar summary details
    vscode.window.showInformationMessage(
        `GreenOps: ${summary.total_joules.toFixed(2)} Joules (${(summary.gCO2eq * 1000).toFixed(2)} mgCO2eq) | Duration: ${summary.duration_s.toFixed(2)}s`
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
                    `### ⚠️ Inefficient Code Hotspot\n` +
                    `- **Marginal Cost**: ${item.joules.toFixed(2)} Joules\n` +
                    `- **Footprint Contribution**: ~${((item.joules / summary.total_joules) * 100).toFixed(0)}%\n\n` +
                    `*Recommendation*: ${item.reason}`
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
                hoverMessage: new vscode.MarkdownString(`🟢 **GreenOps Efficient Baseline**: Consumes negligible marginal idle energy.`)
            });
        }
    }

    editor.setDecorations(redLineDecoration, redDecorations);
    editor.setDecorations(greenLineDecoration, greenDecorations);
}

export function deactivate() {}
