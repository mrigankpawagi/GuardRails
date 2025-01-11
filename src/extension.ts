import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

let extensionUri: vscode.Uri;

class GuardRailsViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _excentionContext: vscode.ExtensionContext
    ) { }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            undefined,
            this._excentionContext.subscriptions
        );

        setWebviewContent(webviewView.webview, this._extensionUri);
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case "submitFunction":
                const pythonPath = vscode.workspace
                    .getConfiguration("guardrails")
                    .get("whichpython", "python");
                const scriptPath = path.join(
                    this._extensionUri.fsPath,
                    "media",
                    "python",
                    "main.py"
                );

                try {
                    const python = child_process.spawn(pythonPath, [scriptPath]);

                    python.stdin.write(JSON.stringify(message.data));
                    python.stdin.end();

                    let output = "";
                    python.stdout.on("data", (data) => {
                        output += data.toString();
                    });

                    python.on("close", (code) => {
                        if (code === 0 && this._view) {
                            this._view.webview.postMessage({
                                command: "pythonResult",
                                data: JSON.parse(output),
                            });
                        } else {
                            throw new Error(`Python process exited with code ${code}`);
                        }
                    });
                } catch (error: any) {
                    vscode.window.showErrorMessage(
                        "Failed to execute Python script: " + error.message
                    );
                }
                break;
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    extensionUri = context.extensionUri;

    const provider = new GuardRailsViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("guardrails.sidebar", provider, {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        })
    );

    // Register command to open panel
    context.subscriptions.push(
        vscode.commands.registerCommand("guardrails.openPanel", async () => {
            await vscode.commands.executeCommand(
                "workbench.view.extension.guardrails-sidebar"
            );
        })
    );
}

export function deactivate() { }

function setWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const mediaUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "media")
    );

    const htmlPath = vscode.Uri.joinPath(extensionUri, "media", "index.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf-8");

    // Replace placeholders with actual URIs
    html = html.replace("#{baseUri}", mediaUri.toString());

    webview.html = html;
}
