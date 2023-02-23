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
} from "./tools";
import { Problem, Testcase } from "./types";
const sqlite3 = require("sqlite3").verbose();
var fs = require("fs");

var snapshot: any;
var db: any;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  /* INITIALIZE DATABASE */
  var storageFolder = decodeURIComponent(context.globalStorageUri + "").split(
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
      provider_problemStatement
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
      vscode.window.showInformationMessage("VSPrutor has been activated!");
    }
  );

  context.subscriptions.push(disposable);

  var prevText: string;
  var currentProblem: Problem;

  vscode.commands.registerCommand("vsprutor.CommitTracker", () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      // Get all the text in editor
      const text = editor.document.getText();
      logEntry(currentProblem, text, "editor.action.inlineSuggest.commit");
      prevText = text;
    }

    vscode.commands.executeCommand("editor.action.inlineSuggest.commit");
  });
  vscode.commands.registerCommand("vsprutor.NextWordTracker", () => {
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
    vscode.commands.executeCommand(
      "editor.action.inlineSuggest.acceptNextWord"
    );
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
      var currentlyOpenTabfilePath =
        vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!currentlyOpenTabfilePath) {
        vscode.window.showErrorMessage("Please open a file before executing.");
        return;
      }

      var program = vscode.window.activeTextEditor?.document.getText();

      // var counter = 0;

      problem.testcases.forEach((testcase) => {
        var runTerminal;
        switch (lang) {
          case "python":
            runTerminal = spawn("python", [currentlyOpenTabfilePath!]);
            var output = "";

            runTerminal.stdout.on("data", (data) => {
              // Replace all \r\n with \n
              output += data.toString().replace(/\r\n/g, "\n");
            });

            runTerminal.stdin.write(testcase.input);
            runTerminal.stdin.end();

            runTerminal.on("close", (code) => {
              // code = Exit code during compilation
              // logExecution(problem, program!, output, code!);
              testcase.output = output.trim(); // Should we trim the output in general?
              if(code === 0){
                testcase.status = testcase.output === testcase.correctOutput ? "Correct" : "Incorrect";
              }
              else{
                testcase.status = "Error";
              }
              // counter += 1;
              // if(counter === problem.testcases.length){
              //   provider_testcases.update(problem.testcases);
              // }
              provider_testcases.update(problem.testcases);
              logTest(problem, testcase, program!);
            });
            break;
          case "c":
            // TODO: C Execution is very unstable and inconsistent!


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

                runTerminal.stdin.write(testcase.input);
                runTerminal.stdin.end();

                runTerminal.on("close", (code) => {
                  // code = Exit code during execution
                  // logExecution(problem, program!, output, code!);
                  // provider_execute.pushOutput(output);
                  testcase.output = output.trim(); // Should we trim the output in general?;
                  if(code === 0){
                    testcase.status = testcase.output === testcase.correctOutput ? "Correct" : "Incorrect";
                  }
                  else{
                    testcase.status = "Error";
                  }

                  // counter += 1; console.log(counter, problem.testcases.length, "B");
                  // if(counter === problem.testcases.length){
                  //   provider_testcases.update(problem.testcases);
                  // }
                  provider_testcases.update(problem.testcases);
                  logTest(problem, testcase, program!);
                });
              } else {
                // Compilation failed
                // logExecution(problem, program!, "", code!);
                testcase.output = "";
                testcase.status = "Error";
                // counter += 1; console.log(counter, problem.testcases.length, "A");
                // if(counter === problem.testcases.length){
                //   provider_testcases.update(problem.testcases);
                // }
                provider_testcases.update(problem.testcases);
                logTest(problem, testcase, program!);
              }
            });

            break;
        }
      });

      // TODO: Find a better way to await all executions!

    }
  );
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

function logTest(
  problem: Problem,
  testcase: Testcase,
  program: string
) {
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
     (time, code, expectedOutout, output, result) VALUES (?, ?, ?, ?, ?)`,
      Date.now(),
      program,
      testcase.correctOutput,
      testcase.output,
      testcase.status
    );
  });
}