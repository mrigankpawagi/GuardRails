var docstringEditor = CodeMirror(document.getElementById('docstringEditor'), {
    lineNumbers: false,
    theme: 'default',
    value: '    Description of your function\n\n    Examples:\n    >>> function_name(...)\n    expected_output\n',
    indentUnit: 4,
    gutters: ["CodeMirror-linenumbers"]
});
// Create imports editor
var importsEditor = CodeMirror(document.getElementById('importsEditor'), {
    mode: 'python',
    lineNumbers: false,
    theme: document.body.classList.contains('vscode-dark') ? 'monokai' : 'default',
    value: 'import typing\n\n# Add any imports from built-in modules\n# or add helper functions here\n',
    indentUnit: 4,
    extraKeys: {
        'Enter': function(cm) {
            var pos = cm.getCursor();
            if (pos.line === 0) {
                // Prevent editing first line
                return;
            }
            cm.replaceSelection('\n');
        }
    }
});

// Make first line read-only
importsEditor.markText(
    {line: 0, ch: 0},
    {line: 1, ch: 0},
    {
        readOnly: true, 
        className: 'readonly-line',
        atomic: true,
        inclusiveLeft: true,
    }
);

function updateWidth(input) {
    let contents = input.value || input.placeholder;
    input.style.width = (contents.length) + 'ch';
}

updateWidth(document.getElementById('functionName'));
updateWidth(document.getElementById('arguments'));
updateWidth(document.getElementById('returnType'));

function createDoctest(functionName) {
    return `\n    >>> ${functionName}(...)\n    expected_output\n`;
}

document.getElementById('addDoctest').addEventListener('click', function() {
    const functionName = document.getElementById('functionName').value || 'function_name';
    const doctest = createDoctest(functionName);
    const doc = docstringEditor.getValue();

    // Insert doctest at the end
    docstringEditor.setValue(doc + doctest);
});

// Update doctest examples when function name changes
function updateDoctestFunctionNames(input) {
    const oldName = input.dataset.lastValue || 'function_name';
    const newName = input.value || 'function_name';
    input.dataset.lastValue = newName;

    // Update existing doctests with new function name
    const content = docstringEditor.getValue();
    const updatedContent = content.replace(
        new RegExp(`>>> ${oldName}\\(`, 'g'), 
        `>>> ${newName}(`
    );

    docstringEditor.setValue(updatedContent);
}

document.getElementById('functionName').addEventListener('input', function(e) {
    updateDoctestFunctionNames(this);
    updateWidth(this);
});

document.getElementById('functionName').addEventListener('change', function() {
    updateDoctestFunctionNames(this);
    updateWidth(this);
});
document.getElementById('arguments').addEventListener('input', function() {
    updateWidth(this);
});
document.getElementById('arguments').addEventListener('change', function() {
    updateWidth(this);
});
document.getElementById('returnType').addEventListener('input', function() {
    updateWidth(this);
});
document.getElementById('returnType').addEventListener('change', function() {
    updateWidth(this);
});

// Add theme observer
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.target.classList.contains('vscode-dark')) {
            importsEditor.setOption('theme', 'monokai');
        } else {
            importsEditor.setOption('theme', 'default');
        }
    });
});

observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});
