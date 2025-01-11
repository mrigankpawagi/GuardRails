import * as vscode from "vscode";
import * as fs from 'fs';

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
  const mediaUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media'));
  
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'index.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf-8');
  
  // Replace placeholders with actual URIs
  html = html.replace('#{baseUri}', mediaUri.toString());
  
  webview.html = html;
}
