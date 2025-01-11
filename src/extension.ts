import * as vscode from "vscode";

let extensionUri: vscode.Uri;

class GuardRailsViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    setWebviewContent(webviewView.webview, this._extensionUri);
  }
}

export function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;

  const provider = new GuardRailsViewProvider(context.extensionUri);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('guardrails.sidebar', provider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  // Register command to open panel
  context.subscriptions.push(vscode.commands.registerCommand('guardrails.openPanel', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.guardrails-sidebar');
  }));
}

export function deactivate() {}

function setWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'view.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'view.css'));

  webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleUri}" rel="stylesheet">
    </head>
    <body>
      <main>
        <h2>GuardRails</h2>
        <!-- Add your webview content here -->
      </main>
      <script src="${scriptUri}"></script>
    </body>
    </html>`;
}
