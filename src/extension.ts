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

  storageFolder = decodeURIComponent(context.globalStorageUri + "").split(
    "vscode-userdata:/"
  )[1];
  if (!fs.existsSync(storageFolder)) {
    fs.mkdirSync(storageFolder);
  }

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

function fixSuggestion(suggestion: string, context: string){
  suggestion = suggestion.split("```")[0]; // Some suggestions have a section followed by ``` which should be removed

  // check if copilot suggestion already contains the context
  if(suggestion.replace(/\s/g, "").indexOf(context.replace(/\s/g, "")) < 0){
    // Last line of context is repeated in the suggestion and should be removed
    //
    // Observation: If suggestion does not contain context, 
    // its indentation is somtimes messed up. 
    // TODO: Fix this indentation issue; UPDATE: A (possibly partial) fix has been implemented below

    // count intend spaces in context
    var indent = 0;
    var spaceOrTab = false;
    const match = context.slice(1 + context.lastIndexOf("\n")).match(/^[ \t]+/);
    if (match) {
      indent = match[0].length;
      spaceOrTab = (match[0][0] === " "); // true if space, false if tab
    }

    // count intend spaces in suggestion
    var indent2 = 0;
    var spaceOrTab2 = false;
    const match2 = suggestion.match(/^[ \t]+/);
    if (match2) {
      indent2 = match2[0].length;
      spaceOrTab2 = (match2[0][0] === " "); // true if space, false if tab
    }

    if(indent2 !== indent || spaceOrTab2 !== spaceOrTab){
      suggestion = ("\n" + suggestion).replace("\n" + (spaceOrTab2 ? " " : "\t").repeat(indent2), 
                                      "\n" + (spaceOrTab ? " " : "\t").repeat(indent));
    }

    var modContext: string; // modified context string 
    
    // remove last line of context if it is only whitespace
    if(context.slice(1 + context.lastIndexOf("\n")).trim() === ""){
      modContext = context.slice(0, context.lastIndexOf("\n"));
    }
    else{
      // add a newline to the end of context
      modContext = context + "\n";
    }

    suggestion = modContext + suggestion;
  }
  return suggestion;
}

async function checkSuggestions(suggestionList: Array<string>, context: string, callBack: Function){
  var goodSuggestions: string[] = [];
  var goodSuggestionsIndex: number[] = [];

  var counter = 0;
  
  suggestionList.forEach((suggestion, i) => {

    // run the python file and check if doctest(s) passed (in which case there is no output)
    var runTerminal = spawn("python", [`${storageFolder}/suggest${i}.py`]);
    var output = "";
    runTerminal.stdout.on("data", (data) => {
      // Replace all \r\n with \n
      output += data.toString().replace(/\r\n/g, "\n");
    });
    runTerminal.stdin.end();
    runTerminal.on("close", async (code) => {
      // code = Exit code during compilation

      if(code === 0 && output.trim() === ""){
        // doctest(s) passed
        goodSuggestions.push(suggestion);
        goodSuggestionsIndex.push(i);
      }
      else{
        // Bad suggestion
      }

      counter++;
      if(counter === suggestionList.length){
        // All suggestions have been processed

        callBack(goodSuggestions, goodSuggestionsIndex);
      }
    });  
  });
}

async function trimSuggestions(suggestions: string, context: string, viewColumn: vscode.ViewColumn | undefined){
  var goodSuggestions: string[] = [];
  var goodSuggestionsIndex: number[] = [];

  var suggestionsList: Array<string> = suggestions.split("=======\n").splice(1).map(e => {
    return fixSuggestion(e.slice(2 + e.indexOf("\n")), context);
  });
  
  suggestionsList.forEach((suggestion, i) => {
    // create a python file for each suggestion
    vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/suggest${i}.py`), 
      new Uint8Array(Buffer.from(suggestion + 
        `\n\nif __name__ == "__main__":\n\timport doctest\n\tdoctest.testmod()`
      ))
    );
  });

  checkSuggestions(suggestionsList, context, async (goodSuggestions: string[], goodSuggestionsIndex: number[]) => {
    const document = await vscode.workspace.openTextDocument({
      content: `Suggestions which satisfy the doctests (${goodSuggestions.length}/${suggestionsList.length}).\n\n` 
                + goodSuggestions.join("\n\n----------\n\n"),
    });
    vscode.window.showTextDocument(document, viewColumn); // Show in same column as copilot suggestions
  
    if(goodSuggestions.length > 0){
      suggestDoctests(goodSuggestions, goodSuggestionsIndex, viewColumn);
    }
  });      
}

async function trimSuggestionsMUT(suggestions: string, context: string, viewColumn: vscode.ViewColumn | undefined){

  var goodSuggestions: string[] = [];
  var goodSuggestionsIndex: number[] = [];

  var suggestionsList: Array<string> = suggestions.split("=======\n").splice(1).map(e => {
    return fixSuggestion(e.slice(2 + e.indexOf("\n")), context);
  });

  var mutatedSuggestions: Array<string> = [];

  // create a dummy test file
  vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/test_dummy.py`), 
    new Uint8Array(Buffer.from(""))
  );

  var counter = 0;

  suggestionsList.forEach((suggestion, i) => {

    // create a python file for each suggestion (without running doctests)
    vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/suggest${i}_m.py`), 
      new Uint8Array(Buffer.from(suggestion))
    );

    // generate mutations of this file
    child_process.exec(`mutpy --target ${storageFolder}/suggest${i}_m.py --unit-test ${storageFolder}/test_dummy.py -m`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        vscode.window.showInformationMessage(
          "Error creating mutations. Please try again later."
        );
        return false;
      }
      stdout.split("-".repeat(80)).forEach((e, j) => {
        if(j % 2 !== 0){
          mutatedSuggestions.push(e);
        }
      });
      counter++;
      if(counter === suggestionsList.length){
        // All suggestions have been mutated
        var allSuggestions: Array<string> = suggestionsList.concat(mutatedSuggestions);

        allSuggestions.forEach((suggestion, i) => {
          // create a python file for each suggestion
          vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/suggest${i}.py`), 
            new Uint8Array(Buffer.from(suggestion + 
              `\n\nif __name__ == "__main__":\n\timport doctest\n\tdoctest.testmod()`
            ))
          );
        });

        checkSuggestions(allSuggestions, context, async (goodSuggestions: string[], goodSuggestionsIndex: number[]) => {
          const document = await vscode.workspace.openTextDocument({
            content: `Suggestions and mutations which satisfy the doctests.\n\n` 
                      + goodSuggestions.join("\n\n----------\n\n"),
          });
          vscode.window.showTextDocument(document, viewColumn); // Show in same column as copilot suggestions
        
          if(goodSuggestions.length > 0){
            suggestDoctests(goodSuggestions, goodSuggestionsIndex, viewColumn);
          }
        });
      }
    });
  });
}

function suggestDoctests(goodSuggestions: string[], goodSuggestionsIndex: number[], viewColumn: vscode.ViewColumn | undefined){
  // check if type annotations are present for arguments
  const argumentArea = goodSuggestions[0].split("(")[1].split(")")[0];
  if((argumentArea.match(/:/g) || []).length < (argumentArea.match(/,/g) || []).length + 1){
    vscode.window.showErrorMessage("Cannot suggest doctests without type annotations on arguments.");
    return;
  }
  vscode.window.showInformationMessage("Generating doctest suggestion...");

  const argumentBuildUp = argumentArea.split(",").map(e => {
    return e.split(":")[0].trim();
  }).join(", ");

  // extract function name
  var func = goodSuggestions[0].split("(")[0].replace("def", "").trim();
 
  // generate the test file
  var runTerminal: child_process.ChildProcessWithoutNullStreams;
  if(goodSuggestions.length > 1){
    runTerminal = spawn("hypothesis", ["write", 
        ...goodSuggestionsIndex.map(e => `suggest${e}.${func}`)
      ], {cwd: storageFolder});
  }
  else{ // goodSuggestions.length === 1
    runTerminal = spawn("hypothesis", ["write", 
      ...goodSuggestionsIndex.map(e => `suggest${e}.${func}`), 
       "--idempotent"
    ], {cwd: storageFolder});
  }
  var output = "";
  runTerminal.stdout.on("data", (data) => {
    // Replace all \r\n with \n
    output += data.toString().replace(/\r\n/g, "\n");
  });
  runTerminal.stdin.end();
  runTerminal.on("close", async (code) => {
    var head = output.slice(output.indexOf("@given"), 1 + output.indexOf(":", output.indexOf("def")));
    var head0 = head.slice(0, 4 + head.indexOf("def "));

    var testFunctions: string[] = [];
    var testCalls: string[] = [];

    if(goodSuggestions.length > 1){

      ((arr) => arr.map( (v, i) => arr.slice(i + 1).map(w => [v, w]) ).flat())(goodSuggestionsIndex).forEach(e => {
        testFunctions.push(`${head0}test${e[0]}_${e[1]}(${argumentBuildUp}):
  global fault
  fault = (${argumentBuildUp})
  assert suggest${e[0]}.${func}(${argumentBuildUp}) == suggest${e[1]}.${func}(${argumentBuildUp})
`);
        testCalls.push(`
  try:
    test${e[0]}_${e[1]}()
  except Exception as e:
    if fault not in faults_list:
      faults_list.append(fault)
`);
      });

    }
    if(goodSuggestions.length === 1){
      testFunctions.push(`${head0}test(${argumentBuildUp}):
  global fault
  fault = (${argumentBuildUp})
  assert suggest${goodSuggestionsIndex[0]}.${func}(${argumentBuildUp}) == suggest${goodSuggestionsIndex[0]}.${func}(${argumentBuildUp})
`);
      testCalls.push(`
  try:
    test()
  except Exception as e:
    faults_list.append(fault)
`);
    }
    var program = 
`import ${goodSuggestionsIndex.map(e => `suggest${e}`).join(", ")}
from hypothesis import given, strategies as st

faults_list = []
fault = None

${testFunctions.join("\n\n")}

if __name__ == "__main__":
  ${testCalls.join("\n")}
  for f in faults_list:
    args = repr(f)
    if isinstance(f, tuple):
      args = args[1:-1]
    print(f">>> ${func}({args})")
`;
    vscode.workspace.fs.writeFile(vscode.Uri.file(storageFolder + `/test.py`), 
      new Uint8Array(Buffer.from(program))
    );
    

    // Run the test file

    var runTerminal = spawn("python", [storageFolder + `/test.py`]);
    var testOutput = "";
    runTerminal.stdout.on("data", (data) => {
      // Replace all \r\n with \n
      testOutput += data.toString().replace(/\r\n/g, "\n");
    });
    runTerminal.stdin.end();
    runTerminal.on("close", async (code) => {
      if(code === 0 && testOutput.trim() !== ""){
        const document = await vscode.workspace.openTextDocument({
          content: `Doctest suggestions:\n\n` 
                    + testOutput,
        });
        vscode.window.showTextDocument(document, viewColumn); // Show in same column as copilot suggestions
      }
      else if(code !== 0){
        vscode.window.showInformationMessage('Error occured while suggesting doctests.');
      }
      else if(testOutput.trim() === ""){
        vscode.window.showInformationMessage('No doctest suggestion found.');
      }
    });

  });
}