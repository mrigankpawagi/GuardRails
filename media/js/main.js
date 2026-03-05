(function() {
    const vscode = acquireVsCodeApi();

    document.getElementById('submitButton').addEventListener('click', function() {
        var imports = importsEditor.getValue();

        var functionName = document.getElementById('functionName').value || "function_name";
        var arguments = document.getElementById('arguments').value;
        var returnType = document.getElementById('returnType').value;
        var docstring = docstringEditor.getValue();
        var declaration = `def ${functionName}(${arguments})${returnType}:\n    """\n${docstring}\n    """`;

        vscode.postMessage({
            command: 'submitFunction',
            data: {
                imports: imports,
                functionName: functionName,
                arguments: arguments,
                returnType: returnType,
                docstring: docstring,
                declaration: declaration
            }
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'submitFunctionResult':
                console.log('Received result:', message.data);
                if (message.data.input_contract) {
                    document.getElementById('contractSection').style.display = 'block';
                    contractEditor.setValue(message.data.input_contract);
                }
                break;
        }
    });

    document.getElementById('submitContract').addEventListener('click', function() {
        vscode.postMessage({
            command: 'submitContract',
            data: {
                contract: contractEditor.getValue()
            }
        });
    });

})();
