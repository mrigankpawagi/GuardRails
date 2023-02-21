import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
import {
  minVersions,
  compareVersion,
  containsRestrictedCommands,
  getLabs,
  loadProblem,
  ProblemStatementViewProvider,
} from "./tools";
import { Problem } from "./types";
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
  getLabs(provider_problemStatement);

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
      logEntry(currentProblem, text, "editor.action.inlineSuggest.acceptNextWord");
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

        if (text !== prevText) { // Don't save if the text hasn't changed
          logEntry(problem, text);
          prevText = text;
        }
      }
    }, 5000); // Save code from active editor every 5 seconds
    // TODO: - Do we need to modify this functionality? (Like, not save code from every editor? Designate a particular file?)
    //       - Should we consider keystrokes and not time?
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  snapshot.clearInterval();
  db.close();
}

function logEntry(problem: Problem, code: string, flag: string = ""){
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
