import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";

const restrictedCommands = [
  "editor.action.inlineSuggest.commit",
  "editor.action.inlineSuggest.acceptNextWord",
];
// TODO: Deal with editor.action.inlineSuggest.trigger and github.copilot.generate (commands which show the suggestion but don't commit it)

const minVersions: Array<{
  compiler: string;
  version: string;
  output: string;
}> = [
  {
    compiler: "python", // Terminal command (<command> --version)
    version: "3.6.0", // Minimum version
    output: "Python", // Name used in output
  },
  {
    compiler: "gcc",
    version: "4.8.0",
    output: "gcc",
  },
];
// TODO: - Check for syntax on Mac and Linux
//       - Ask Prof. Viraj if any other compilers need to be checked

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
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

  var snapshot = setInterval(function () {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      // Get all the text in editor
      const text = editor.document.getText();
      
	  
    }
  }, 5000); // Save code from active editor every 5 seconds

  let disposable = vscode.commands.registerCommand(
    "vsprutor.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from HelloWorld!");
    }
  );

  context.subscriptions.push(disposable);

  vscode.commands.registerCommand("vsprutor.CommitTracker", () => {
    // Do what you want!
    vscode.commands.executeCommand("editor.action.inlineSuggest.commit");
  });
  vscode.commands.registerCommand("vsprutor.NextWordTracker", () => {
    // Do what you want!
    vscode.commands.executeCommand(
      "editor.action.inlineSuggest.acceptNextWord"
    );
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}

function containsRestrictedCommands(keybindings: string) {
  // Check if the string keybindings contains any of the restricted commands
  for (let i = 0; i < restrictedCommands.length; i++) {
    if (keybindings.includes(restrictedCommands[i])) {
      return true;
    }
  }
  return false;
}

function compareVersion(version1: string, version2: string): number {
  let v1 = version1.split(".").map(Number);
  let v2 = version2.split(".").map(Number);

  // Remove trailing zeros
  let i = v1.length;
  let j = v2.length;
  while (v1[i - 1] === 0) {
    i--;
  }
  while (v2[j - 1] === 0) {
    j--;
  }

  // Compare v1.slice(0, i) and v2.slice(0, j) lexicographically
  for (let k = 0; k < Math.min(i, j); k++) {
    if (v1[k] > v2[k]) {
      return 1;
    } else if (v1[k] < v2[k]) {
      return -1;
    }
  }
  return 0;
}
