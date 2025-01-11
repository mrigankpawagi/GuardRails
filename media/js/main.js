(function() {
    const vscode = acquireVsCodeApi();

    document.getElementById('submitButton').addEventListener('click', function() {
        var imports = importsEditor.getValue();
        var functionName = document.getElementById('functionName').value || "function_name";
        var arguments = document.getElementById('arguments').value;
        var returnType = document.getElementById('returnType').value;
        var docstring = docstringEditor.getValue();

        var fullDeclaration = `${imports}\n\ndef ${functionName}(${arguments})${returnType}:\n    """\n${docstring}\n    """`;

        vscode.postMessage({
            command: 'submitFunction',
            data: fullDeclaration
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'pythonResult':
                console.log('Received Python result:', message.data);
                break;
        }
    });

})();
