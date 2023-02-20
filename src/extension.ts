import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

const restrictedCommands = ['editor.action.inlineSuggest.commit', 'editor.action.inlineSuggest.acceptNextWord'];
// TODO: Deal with editor.action.inlineSuggest.trigger and github.copilot.generate (commands which show the suggestion but don't commit it)

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "helloworld" is now active!');

	const keybindingsPath = path.join(os.homedir(), 'AppData/Roaming/Code/User/keybindings.json'); 
	// TODO: Look up the path for Linux and Mac users!

	vscode.workspace.fs.readFile(vscode.Uri.file(keybindingsPath)).then(data => {
		if(containsRestrictedCommands(data.toString())){
			vscode.window.showErrorMessage('You have custom keybindings for restricted commands. Please remove them from User/keybindings.json');
		}
    }, error => {
        // console.error(error);
    });

	let disposable = vscode.commands.registerCommand('vsprutor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from HelloWorld!');
	});

	context.subscriptions.push(disposable);

	vscode.commands.registerCommand('vsprutor.CommitTracker', () => {
		// Do what you want!
		vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
	});
	vscode.commands.registerCommand('vsprutor.NextWordTracker', () => {
		// Do what you want!
		vscode.commands.executeCommand('editor.action.inlineSuggest.acceptNextWord');
	});

	
}

// This method is called when your extension is deactivated
export function deactivate() {}

function containsRestrictedCommands(keybindings: string){
	// Check if the string keybindings contains any of the restricted commands
	for (let i = 0; i < restrictedCommands.length; i++){
		if (keybindings.includes(restrictedCommands[i])){
			return true;
		}
	}	
	return false;
}