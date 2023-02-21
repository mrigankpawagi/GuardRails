import * as vscode from "vscode";
const fetch = require("node-fetch");
import { Problem, Lab } from "./types";

const API_ROOT = "http://127.0.0.1:5000"; // Development Environment

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
export async function getLabs(ps_provider: ProblemStatementViewProvider) {
  provider_problemStatement = ps_provider;
  return fetch(API_ROOT + "/get_labs", {
    method: "POST",
  })
    .then((response: any) => {
      return response.json();
    })
    .then((data: { labs: Array<Lab> }) => {
      vscode.window.registerTreeDataProvider(
        "problemlist",
        new TreeDataProvider(data.labs)
      );
      return true;
    })
    .catch((error: any) => {
      // console.error(error);
      return false;
    });
}

export function loadProblem(problem: Problem) {
  provider_problemStatement.putProblem(problem);
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

  constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
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
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

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
