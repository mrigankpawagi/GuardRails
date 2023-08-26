import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
const spawn = child_process.spawn;
var fs = require("fs");

var snapshot: any;
var db: any;
var storageFolder: string;
var extensionUri: any;

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {

  extensionUri = context.extensionUri;

  const rawUri = decodeURIComponent(context.globalStorageUri + "");
  if(rawUri.indexOf("vscode-userdata:/") >= 0){
    // For Windows (and also observed on Ubuntu?!)
    if(process.platform === "win32"){ // Windows
      storageFolder = rawUri.split("vscode-userdata:/")[1];
    }
    else{ // Linux
      storageFolder = rawUri.split("vscode-userdata:")[1];
    } 
  }
  else if(rawUri.indexOf("file:///") >= 0){
    // For Linux
    storageFolder = rawUri.split("file:///")[1];
    storageFolder = "/" + storageFolder;
  }
  else{
    storageFolder = rawUri;
  }
  // TODO: Test on Mac

  if (!fs.existsSync(storageFolder)) {
    fs.mkdirSync(storageFolder);
  }

  const extensionPath = context.extensionPath;

  // copy tester.py from extension to storage folder
  fs.copyFileSync(path.join(extensionPath, "media", "tester.py"), path.join(storageFolder, "tester.py"));

  var textForCopilotPanel: string = "";
  vscode.commands.registerCommand("vsprutor.captureCopilotPanel", () => {

    const currentEditor = vscode.window.activeTextEditor!;
    const position = currentEditor.selection.active;
    textForCopilotPanel = currentEditor.document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    vscode.commands.executeCommand(
      "github.copilot.generate"
    );
  });

  vscode.commands.registerCommand("vsprutor.testCaseChecker", () => {
    // TODO: Support C as well (currently only supports Python)

    vscode.window.showInformationMessage(
      "Starting copilot suggestions trimmer..."
    );

    // See if the preceding code contains a function and a docstring and get the context      
    var codeContext = confirmFunctionAndDocstring(textForCopilotPanel);
    if(!codeContext){
      return;
    }

    // Check copilot suggestions panel every 5 seconds till the contents are stable
    awaitSuggestions(codeContext, trimSuggestions);
    
  });
  
  vscode.commands.registerCommand("vsprutor.testCaseCheckerMUT", () => {
    // TODO: Support C as well (currently only supports Python)

    vscode.window.showInformationMessage(
      "Starting copilot suggestions trimmer with mutations..."
    );

    // See if the preceding code contains a function and a docstring and get the context      
    var codeContext = confirmFunctionAndDocstring(textForCopilotPanel);
    if(!codeContext){
      return;
    }

    // Check copilot suggestions panel every 5 seconds till the contents are stable
    awaitSuggestions(codeContext, trimSuggestionsMUT);
    
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
}


function confirmFunctionAndDocstring(textForCopilotPanel: string){
  // Check if a function definition exists before the cursor
  let defPos = textForCopilotPanel.lastIndexOf("def");
  if(defPos === -1){
    vscode.window.showErrorMessage("No function definition found before cursor.");
    return false;
  }
  else{
    var codeContext = textForCopilotPanel.substring(defPos);
  }

  return codeContext;

}

function awaitSuggestions(codeContext: string, callBack: Function){
  var temp = "";
    var c = setInterval(function () {
      vscode.window.visibleTextEditors.forEach((editor) => {      
        if(editor.document.fileName === "GitHub Copilot"){
          if(temp === editor.document.getText()){
            // Contents are stable
            vscode.window.showInformationMessage(
              "Suggestions captured. Trimming down suggestions based on test cases..."
            );
            callBack(editor.document.getText(), codeContext, editor.viewColumn);
            clearInterval(c);
          }
          else{
            temp = editor.document.getText();
          }
        }
      });
    }, 5000);
}

async function runTester(viewColumn: vscode.ViewColumn | undefined){
  var runTerminal = spawn("python", [`tester.py`], { cwd: storageFolder });
  var output = "";
  runTerminal.stdout.on("data", (data) => {
    // Replace all \r\n with \n
    output += data.toString().replace(/\r\n/g, "\n");
  });
  runTerminal.stdin.end();
  runTerminal.on("close", async (code) => {
    // Display the results
    const panel = vscode.window.createWebviewPanel(
      'results',
      'GuardRails',
      viewColumn!,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // And set its HTML content and send data
    setWebviewContent(panel.webview, output);

  });
}

function trimSuggestions(suggestions: string, context: string, viewColumn: vscode.ViewColumn | undefined){

  // Create a file with the context
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/context.txt`), 
    new Uint8Array(Buffer.from(context))
  );

  // Create a file with dump of all suggestions
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/suggestions.txt`), 
    new Uint8Array(Buffer.from(suggestions))
  );

  // Create a file with configuration of whether to mutate or not (0)
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/mutate.txt`), 
    new Uint8Array(Buffer.from("0"))
  );

  runTester(viewColumn);

}

function trimSuggestionsMUT(suggestions: string, context: string, viewColumn: vscode.ViewColumn | undefined){
  
  // Create a file with the context
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/context.txt`), 
    new Uint8Array(Buffer.from(context))
  );

  // Create a file with dump of all suggestions
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/suggestions.txt`), 
    new Uint8Array(Buffer.from(suggestions))
  );

  // Create a file with configuration of whether to mutate or not (0)
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/mutate.txt`), 
    new Uint8Array(Buffer.from("1"))
  );

  runTester(viewColumn);

}

function setWebviewContent(webview: vscode.Webview, output: string) {
   // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
   const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'view.js')).toString();

  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'view.css')).toString();

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
        <table id="main-data"></table>
        <hr>
        <table id="results-data"></table>
        <br>
        <small>*Fuzzing involves self-equivalence testing as well.</small>
        <br>
        <small>**Fuzzed suggestions are retained for doctesting.</small>
        <h3>Doctest Suggestions</h3>
        <table id="doctests"></table>
        <h3>Simplified differentiating doctest suggestions</h3>
        <table id="diff-doctests">
          <thead>
            <tr>
              <th>Doctest</th>
              <th>Equivalence Classes</th>
            </tr>
          </thead>
        </table>
        <hr>
        <h3>All valid suggestions</h3>
        <div id="all-suggestions"></div>
      </main>
      <script src="${scriptUri}"></script>
    </body>
    </html>`;

    webview.postMessage({ command: 'data', data: output });
}
