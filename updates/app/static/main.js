document.getElementById('codeForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    var imports = importsEditor.getValue();
    var functionName = document.getElementById('functionName').value;
    var arguments = document.getElementById('arguments').value;
    var returnType = document.getElementById('returnType').value;
    var docstring = docstringEditor.getValue();

    var fullDeclaration = `${imports}\n\ndef ${functionName}(${arguments})${returnType}:\n    """\n${docstring}\n    """`;

    fetch(`/submit?declaration=${encodeURIComponent(fullDeclaration)}`)
        .then(response => response.text())
        .then(data => {
            console.log('Form submitted successfully!');
            console.log(data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
});
