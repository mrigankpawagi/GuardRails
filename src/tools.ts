import * as vscode from "vscode";
const fetch = require("node-fetch");
import { Problem, Lab, Testcase } from "./types";
import * as child_process from "child_process";
const util = require("util");
import { parse } from "node-html-parser";

// Promisified exec
const pexec = util.promisify(child_process.exec);

const API_ROOT = vscode.workspace.getConfiguration("vsprutor").server; // URL where Prutor is served

const restrictedCommands = [
  "editor.action.inlineSuggest.commit",
  "editor.action.inlineSuggest.acceptNextWord",
];
// TODO: Deal with editor.action.inlineSuggest.trigger and github.copilot.generate (commands which show the suggestion but don't commit it)

export const minVersions: Array<{
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

// eslint-disable-next-line @typescript-eslint/naming-convention
var provider_problemStatement: ProblemStatementViewProvider; // Extension context passed from activating function to getLabs()
// eslint-disable-next-line @typescript-eslint/naming-convention
var provider_execute: ExecuteViewProvider;
// eslint-disable-next-line @typescript-eslint/naming-convention
var provider_testCases: TestCasesViewProvider;

export function containsRestrictedCommands(keybindings: string) {
  // Check if the string keybindings contains any of the restricted commands
  for (let i = 0; i < restrictedCommands.length; i++) {
    if (keybindings.includes(restrictedCommands[i])) {
      return true;
    }
  }
  return false;
}

export function compareVersion(version1: string, version2: string): number {
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

// eslint-disable-next-line @typescript-eslint/naming-convention
export async function getLabs(ps_provider: ProblemStatementViewProvider, exec_provider: ExecuteViewProvider, tc_provider: TestCasesViewProvider
) {
  provider_problemStatement = ps_provider;
  provider_execute = exec_provider;
  provider_testCases = tc_provider;

  var authCookie = await loginAndReturnCookie();

  if (authCookie) {
    let fetchCmd = `curl -H "Cookie:${authCookie}" -X GET "${API_ROOT}/codebook"`;

    child_process.exec(fetchCmd, (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.log(`error: ${error.message}`);
        vscode.window.showInformationMessage(
          "Error fetching problems. Please try again later."
        );
        return false;
      }
      vscode.window.registerTreeDataProvider(
        "problemlist",
        new TreeDataProvider(extractLabData(stdout))
      );
      return true;
    });
  }
}

export function loadProblem(problem: Problem) {
  provider_problemStatement.putProblem(problem);
  provider_execute.start(problem);
  provider_testCases.start(problem);
}

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  onDidChangeTreeData?: vscode.Event<TreeItem | null | undefined> | undefined;

  data: TreeItem[];

  constructor(data: Array<Lab>) {
    this.data = [];
    for (let i = 0; i < data.length; i++) {
      this.data.push(
        new TreeItem(
          data[i].name,
          data[i].problems.map(
            (problem: Problem) =>
              new TreeItem(
                problem.name,
                undefined,
                "vsprutor.loadProblem",
                "Open Problem",
                problem
              )
          )
        )
      );
    }
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(
    element?: TreeItem | undefined
  ): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
}

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

  constructor(
    label: string,
    children?: TreeItem[],
    commandId: string = "",
    commandTitle: string = "",
    commandArgument?: any
  ) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.children = children;
    if (commandId !== "") {
      this.command = {
        command: commandId,
        title: commandTitle,
        arguments: [commandArgument ? commandArgument : this],
      };
    }
  }
}

export class ProblemStatementViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "problemStatementView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }
  public putProblem(problem: Problem) {
    if (this._view) {
      this._view.webview.postMessage({ problem: problem });
    }
  }
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "problemStatement.js")
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body>
				<h3 id="problem-name"></h3>
        <p id="problem-description"></p>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export class ExecuteViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "executeView";

  private _view?: vscode.WebviewView;

  private activeProblem?: Problem;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "input": {
          vscode.commands.executeCommand(
            "vsprutor.execute",
            data.language,
            data.value,
            this.activeProblem
          );
          break;
        }
      }
    });
  }
  public start(problem: Problem) {
    this.activeProblem = problem;
    if (this._view) {
      this._view.webview.postMessage({ type: "start" });
    }
  }
  public pushOutput(output: string) {
    if (this._view) {
      this._view.webview.postMessage({ type: "output", value: output });
    }
  }
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "execute.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "execute.css")
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
        <main style="display: none;">
          <b>Language</b>
          <select id="language" value="python">
            <option value="python">Python</option>
            <option value="c">C</option>
          </select>
          <b>Input (STDIN)</b>
          <textarea id="input"></textarea>
          <button>Run</button>
          <br>
          <b>Output (STDOUT)</b>
          <textarea id="output" readonly></textarea>
        </main>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export class TestCasesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "testcasesView";

  private _view?: vscode.WebviewView;

  private activeProblem?: Problem;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "run": {
          vscode.commands.executeCommand(
            "vsprutor.test",
            data.value,
            this.activeProblem
          );
          break;
        }
      }
    });
  }
  public start(problem: Problem) {
    this.activeProblem = problem;

    if (this._view) {
      this._view.webview.postMessage({
        type: "start",
        value: problem.testcases,
      });
    }
  }
  public update(testcases: Array<Testcase>) {
    // console.log(testcases);

    if (this._view) {
      this._view.webview.postMessage({ type: "update", value: testcases });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "testcases.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "testcases.css")
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
        <main style="display: none;">
          <b>Visible Test Cases</b>
          <br>
          <table></table>    
          <b id="result"></b>
          <br>
          <br>
          <select id="language" value="python">
            <option value="python">Python</option>
            <option value="c">C</option>
          </select>
          <button id="runVisible">Run</button>
          <br>
          <button>Run Hidden Test Cases</button>
        </main>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

// Return header value for Cookie Header
async function loginAndReturnCookie() {
  let loginCmd = `curl  --cookie-jar - -d "username=${encodeURIComponent(
    vscode.workspace.getConfiguration("vsprutor").username
  )}&password=${encodeURIComponent(
    vscode.workspace.getConfiguration("vsprutor").password
  )}" -X POST "${API_ROOT}/accounts/login"`;
  // TODO: Modify for other operating systems?

  return (function () {
    return pexec(loginCmd);
  })().then((result: any) => {
    if (result.error) {
      vscode.window.showInformationMessage(
        "Error authenticating. Please try again later."
      );
      return false;
    }
    if (result.stdout.slice(0, 4) !== "true") {
      vscode.window.showInformationMessage(
        "Incorrect username or password. Please check your settings."
      );
      return false;
    }
    var cookie =
      "its=" + result.stdout.split("\t")[result.stdout.split("\t").length - 1]; // Cookie is at the end of the string
    cookie = cookie.trim();

    // Activate cookie by making a request to homepage, before returning cookie
    return (() => {
      return pexec(`curl -H "Cookie:${cookie}" -X GET "${API_ROOT}/home"`);
    })().then(() => {
      return cookie;
    });
  });
}

function extractLabData(text: string) {
  var html = parse(text);
  var labData: Array<Lab> = [];
  html.querySelectorAll(".tree-events > ul > li").forEach((lab, i) => {
    var name = lab.innerHTML.split("<ul>")[0].trim();
    var labId = i;
    var problems: Array<Problem> = [];
    lab.querySelectorAll("ul > li").forEach((prob, j) => {
      problems.push({
        name: prob.innerText.trim(),
        id: j,
        labid: labId,
        testcases: [],
        description: "",
      });
    });
    labData.push({
      name: name,
      id: labId,
      problems: problems,
    });
  });
  return labData;
}
