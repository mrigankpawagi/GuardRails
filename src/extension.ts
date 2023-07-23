import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
const spawn = child_process.spawn;
var fs = require("fs");

var snapshot: any;
var db: any;
var storageFolder: string;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

  const rawUri = decodeURIComponent(context.globalStorageUri + "");
  if(rawUri.indexOf("vscode-userdata:/") >= 0){
    // For Windows
    storageFolder = rawUri.split("vscode-userdata:/")[1];
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

  const extenstionPath = context.extensionPath;

  // copy tester.py from extension to storage folder
  fs.copyFileSync(path.join(extenstionPath, "media", "tester.py"), path.join(storageFolder, "tester.py"));

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

  // Check if a docstring exists after the definition
  const docMatches = codeContext.match( /('''|""")([\s\S]*?)\1/);
  if(!docMatches){
    vscode.window.showErrorMessage("No docstring found after function definition.");
    return false;
  }
  else{
    var docstring = docMatches[2];
  }

  // Check if the docstring contains a test case
  const doctestFind = docstring.indexOf(">>>");
  if(doctestFind === -1){
    vscode.window.showErrorMessage("No doctest found in docstring.");
    return false;
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
    const document = await vscode.workspace.openTextDocument({content: output});
    vscode.window.showTextDocument(document, viewColumn);
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
