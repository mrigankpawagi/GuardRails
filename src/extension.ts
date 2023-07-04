import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
const spawn = child_process.spawn;
import {
  minVersions,
  compareVersion,
  containsRestrictedCommands,
  getLabs,
  loadProblem,
  ProblemStatementViewProvider,
  ExecuteViewProvider,
  TestCasesViewProvider,
  evaluate,
  submit
} from "./tools";
import { Problem, Testcase } from "./types";
const sqlite3 = require("sqlite3").verbose();
var fs = require("fs");

var snapshot: any;
var db: any;
var storageFolder: string;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  /* INITIALIZE DATABASE */
  storageFolder = decodeURIComponent(context.globalStorageUri + "").split(
    "vscode-userdata:/"
  )[1];
  if (!fs.existsSync(storageFolder)) {
    fs.mkdirSync(storageFolder);
  }
  db = new sqlite3.Database(storageFolder + "/vsprutor.db");

  /* Initialize Web View */

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const provider_problemStatement = new ProblemStatementViewProvider(
    context.extensionUri
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProblemStatementViewProvider.viewType,
      provider_problemStatement,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const provider_execute = new ExecuteViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ExecuteViewProvider.viewType,
      provider_execute,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const provider_testcases = new TestCasesViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TestCasesViewProvider.viewType,
      provider_testcases,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Create status bar item for displaying Assingment ID
  var statusBarAssignmentID = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarAssignmentID.command = "vsprutor.helloWorld";
  context.subscriptions.push(statusBarAssignmentID);

  /* CHECK FOR RESTRICTED KEYBINDINGS */

  const keybindingsPath = path.join(
    os.homedir(),
    "AppData/Roaming/Code/User/keybindings.json"
  );
  // TODO: Look up the path for Linux and Mac users!

  vscode.workspace.fs.readFile(vscode.Uri.file(keybindingsPath)).then(
    (data) => {
      if (containsRestrictedCommands(data.toString())) {
        vscode.window.showErrorMessage(
          "You have custom keybindings for restricted commands. Please remove them from User/keybindings.json"
        );
      }
    },
    (error) => {
      // console.error(error);
    }
  );

  /* CHECK COMPILER VERSIONS	*/

  for (let i = 0; i < minVersions.length; i++) {
    let compiler = minVersions[i].compiler;
    let minVersion = minVersions[i].version;
    let output = minVersions[i].output;

    child_process.exec(compiler + " --version", (error, stdout, stderr) => {
      if (error) {
        // console.error(error);
      } else {
        // Extract the version number from the output
        const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          const version = versionMatch[0];

          if (compareVersion(version, minVersion) < 0) {
            vscode.window.showErrorMessage(
              compiler +
                " version " +
                version +
                " is not supported. Please upgrade to version " +
                minVersion +
                " or higher."
            );
          }
          else{
            // installDependencies();
          }
        } else {
          // console.error(`Could not determine ${output} version`);
        }
      }
    });
  }

  /* FETCH PROBLEMS */
  getLabs(provider_problemStatement, provider_execute, provider_testcases);

  let disposable = vscode.commands.registerCommand(
    "vsprutor.helloWorld",
    () => {
      // vscode.window.showInformationMessage("VSPrutor has been activated!");
    }
  );

  context.subscriptions.push(disposable);

  var prevText: string;
  var currentProblem: Problem;

  vscode.commands.registerCommand("vsprutor.CommitTracker", () => {
    if(currentProblem){
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Get all the text in editor
        const text = editor.document.getText();
        logEntry(currentProblem, text, "editor.action.inlineSuggest.commit");
        prevText = text;
      }
    }
    vscode.commands.executeCommand("editor.action.inlineSuggest.commit");
  });
  vscode.commands.registerCommand("vsprutor.NextWordTracker", () => {
    if(currentProblem){
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Get all the text in editor
        const text = editor.document.getText();
        logEntry(
          currentProblem,
          text,
          "editor.action.inlineSuggest.acceptNextWord"
        );
        prevText = text;
      }
    }
    vscode.commands.executeCommand(
      "editor.action.inlineSuggest.acceptNextWord"
    );
  });
  vscode.commands.registerCommand("vsprutor.setStatusBarAssignmentID", (id) => {
    statusBarAssignmentID.text = `$(target) ${id}`;
    statusBarAssignmentID.show();
  });

  vscode.commands.registerCommand("vsprutor.loadProblem", (problem) => {
    currentProblem = problem;
    loadProblem(problem);

    snapshot = setInterval(function () {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Get all the text in editor
        const text = editor.document.getText();

        if (text !== prevText) {
          // Don't save if the text hasn't changed
          logEntry(problem, text);
          prevText = text;
        }
      }
    }, 5000); // Save code from active editor every 5 seconds
    // TODO: - Do we need to modify this functionality? (Like, not save code from every editor? Designate a particular file?)
    //       - Should we consider keystrokes and not time? (How do we implement it?)
  });

  vscode.commands.registerCommand(
    "vsprutor.execute",
    (lang: string, input: string, problem: Problem) => {
      // TODO: TEST THIS FUNCTION ON OTHER OPERATING SYSTEMS!

      if (vscode.window.activeTextEditor?.document.uri.scheme === "untitled") {
        vscode.window.showErrorMessage(
          "Please save the file before executing."
        );
        return;
      }

      var currentlyOpenTabfilePath =
        vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!currentlyOpenTabfilePath) {
        vscode.window.showErrorMessage("Please open a file before executing.");
        return;
      }

      var program = vscode.window.activeTextEditor?.document.getText();
      var runTerminal;
      switch (lang) {
        case "python":
          runTerminal = spawn("python", [currentlyOpenTabfilePath!]);
          var output = "";

          runTerminal.stdout.on("data", (data) => {
            output += data.toString().replace(/\r\n/g, "\n");
          });

          runTerminal.stdin.write(input);
          runTerminal.stdin.end();

          runTerminal.on("close", (code) => {
            // code = Exit code during compilation
            logExecution(problem, program!, output, code!);
            provider_execute.pushOutput(output);
          });
          break;
        case "c":
          runTerminal = spawn("gcc", [currentlyOpenTabfilePath!]);
          runTerminal.stdout.on("data", (data) => {
            output += data.toString().replace(/\r\n/g, "\n");
          });

          runTerminal.on("close", (code) => {
            // code = Exit code during compilation

            if (code === 0) {
              // Compilation successful
              runTerminal = spawn("a.exe"); // TODO: modify for other operating systems!
              var output = "";

              runTerminal.stdout.on("data", (data) => {
                output += data.toString().replace(/\r\n/g, "\n");
              });

              runTerminal.stdin.write(input);
              runTerminal.stdin.end();

              runTerminal.on("close", (code) => {
                // code = Exit code during execution
                logExecution(problem, program!, output, code!);
                provider_execute.pushOutput(output);
              });
            } else {
              // Compilation failed
              logExecution(problem, program!, "", code!);
            }
          });

          break;
      }
    }
  );

  vscode.commands.registerCommand(
    "vsprutor.test",
    (lang: string, problem: Problem) => {
      
      if (vscode.window.activeTextEditor?.document.uri.scheme === "untitled") {
        vscode.window.showErrorMessage(
          "Please save the file before running on test cases."
        );
        return;
      }

      var currentlyOpenTabfilePath =
        vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!currentlyOpenTabfilePath) {
        vscode.window.showErrorMessage("Please open a file before executing.");
        return;
      }

      var program = vscode.window.activeTextEditor?.document.getText();

      switch (lang) {
        case "python":
          problem.testcases.forEach((testcase) => {
            var runTerminal = spawn("python", [currentlyOpenTabfilePath!]);
            var output = "";

            runTerminal.stdout.on("data", (data) => {
              // Replace all \r\n with \n
              output += data.toString().replace(/\r\n/g, "\n");
            });

            runTerminal.stdin.write(testcase.input);
            runTerminal.stdin.end();

            runTerminal.on("close", (code) => {
              // code = Exit code during compilation
              testcase.output = output.trim(); // Should we trim the output in general?
              if (code === 0) {
                testcase.status =
                  testcase.output === testcase.correctOutput
                    ? "Correct"
                    : "Incorrect";
              } else {
                testcase.status = "Error";
              }
              provider_testcases.update(problem.testcases);
              logTest(problem, testcase, program!);
            });
          });
          break;

        case "c":
          var runTerminal = spawn("gcc", [currentlyOpenTabfilePath!]);

          runTerminal.on("close", (code) => {
            // code = Exit code during compilation

            if (code === 0) {
              // Compilation successful

              problem.testcases.forEach((testcase) => {
                var runTerminal = spawn("a.exe"); // TODO: modify for other operating systems!
                var output = "";

                runTerminal.stdout.on("data", (data) => {
                  output += data.toString().replace(/\r\n/g, "\n");
                });

                runTerminal.stdin.write(testcase.input);
                runTerminal.stdin.end();

                runTerminal.on("close", (code) => {
                  // code = Exit code during execution
                  testcase.output = output.trim(); // Should we trim the output in general?
                  if (code === 0) {
                    testcase.status =
                      testcase.output === testcase.correctOutput
                        ? "Correct"
                        : "Incorrect";
                  } else {
                    testcase.status = "Error";
                  }
                  provider_testcases.update(problem.testcases);
                  logTest(problem, testcase, program!);
                });
              });
            } else {
              // Compilation failed
              problem.testcases.forEach((testcase) => {
                testcase.status = "Error";
                provider_testcases.update(problem.testcases);
                logTest(problem, testcase, program!);
              });
            }
          });

          break;
      }
    }
  );

  vscode.commands.registerCommand("vsprutor.evaluate", (problem) => {
    var program = vscode.window.activeTextEditor?.document.getText();
    evaluate(problem, program!);
  });

  vscode.commands.registerCommand("vsprutor.submit", (problem) => {
    var program = vscode.window.activeTextEditor?.document.getText();
    submit(problem, program!);
  });

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
  snapshot.clearInterval();
  db.close();
}

function logEntry(problem: Problem, code: string, flag: string = "") {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS L${problem.labid}_P${problem.id} 
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      time TEXT,
      code TEXT,
      flag TEXT
    )`
    );
    db.run(
      `INSERT INTO L${problem.labid}_P${problem.id}
     (time, code, flag) VALUES (?, ?, ?)`,
      Date.now(),
      code,
      flag
    );
  });
}

function logExecution(
  problem: Problem,
  program: string,
  output: string,
  exitCode: number
) {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS L${problem.labid}_P${problem.id}_exec 
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      time TEXT,
      code TEXT,
      output TEXT,
      exitCode INTEGER
    )`
    );
    db.run(
      `INSERT INTO L${problem.labid}_P${problem.id}_exec
     (time, code, output, exitCode) VALUES (?, ?, ?, ?)`,
      Date.now(),
      program,
      output,
      exitCode
    );
  });
}
// TODO: - Should we also store the language?
//       - Should language be fixed by the instructor for each lab/problem?

function logTest(problem: Problem, testcase: Testcase, program: string) {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS L${problem.labid}_P${problem.id}_tests 
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      time TEXT,
      code TEXT,
      expectedOutput TEXT,
      output TEXT,
      result INTEGER
    )`
    );
    db.run(
      `INSERT INTO L${problem.labid}_P${problem.id}_tests
     (time, code, expectedOutput, output, result) VALUES (?, ?, ?, ?, ?)`,
      Date.now(),
      program,
      testcase.correctOutput,
      testcase.output,
      testcase.status
    );
  });
}

// function installDependencies(){
//   var runTerminal1 = spawn("python", ["-m", "pip", "install", 
//     "hypothesis", 
//     "hypothesis[cli]", 
//     "black", 
//     "hypothesis[ghostwriter]"
//   ]);
//   runTerminal1.stdin.end();
//   runTerminal1.on("close", async (code) => {
//     if(code !== 0){
//       vscode.window.showErrorMessage("Could not install dependencies for doctest suggestion.");
//     }
//   });
  
//   var runTerminal2 = spawn("python", ["-m", "pip", "install", "git+https://github.com/mrigankpawagi/mutpy.git#egg=mutpy"]);
//   runTerminal2.stdin.end();
//   runTerminal2.on("close", async (code) => {
//     if(code !== 0){
//       vscode.window.showErrorMessage("Could not install dependencies for mutations.");
//     }
//   });
// }

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
  
    if(goodSuggestions.length > 1){
      suggestDoctests(goodSuggestions, goodSuggestionsIndex, document);
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
    child_process.exec(`mut.py --target ${storageFolder}/suggest${i}_m.py --unit-test ${storageFolder}/test_dummy.py -m`, (error, stdout, stderr) => {
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
        
          if(goodSuggestions.length > 1){
            suggestDoctests(goodSuggestions, goodSuggestionsIndex, document);
          }
        });
      }
    });
  });
}

function suggestDoctests(goodSuggestions: string[], goodSuggestionsIndex: number[], document: vscode.TextDocument){
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
  var runTerminal = spawn("hypothesis", ["write", ...goodSuggestionsIndex.map(e => `suggest${e}.${func}`)],
                          {cwd: storageFolder});
  var output = "";
  runTerminal.stdout.on("data", (data) => {
    // Replace all \r\n with \n
    output += data.toString().replace(/\r\n/g, "\n");
  });
  runTerminal.stdin.end();
  runTerminal.on("close", async (code) => {
    var head = output.slice(output.indexOf("@given"), 1 + output.indexOf(":", output.indexOf("def")));
    var head0 = head.slice(0, 4 + head.indexOf("def "));
    var head1 = head.slice(head.indexOf("(", head.indexOf("def")));
    var program = 
`import ${goodSuggestionsIndex.map(e => `suggest${e}`).join(", ")}
from hypothesis import given, strategies as st

fault = None

${head0} test(${argumentBuildUp}):
    global fault
    fault = (${argumentBuildUp})
    assert ${goodSuggestionsIndex.map(e => `suggest${e}.${func}(${argumentBuildUp})`).join(" == ")}

if __name__ == "__main__":
    try:
        test()
    except AssertionError:
        print(fault)
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
        const parenthesis = testOutput.trim().indexOf("(") < 0;
        vscode.window.showInformationMessage(`Suggested doctest:\n>>> ${func}${parenthesis ? "(" : ""}${testOutput.trim()}${parenthesis ? ")" : ""}`);
      }
    });

  });
}