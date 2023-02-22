// This script will be run within the webview
(function () {

    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.type) {
            case 'start':
                document.querySelector("main").style.display = "block";
                break;
            case 'output':
                document.querySelector("#output").value = data.value;
                break;
        }
    });



    document.querySelector("button").addEventListener("click", function () {
        document.querySelector("#output").value = "";
        vscode.postMessage({ 
            type: 'input', 
            language: document.querySelector("#language").value, 
            value: document.querySelector("#input").value 
        });
    });

}());


