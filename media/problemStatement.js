// This script will be run within the webview
(function () {
    window.addEventListener('message', event => {
        const problem = event.data.problem; // The json data that the extension sent
        document.querySelector("#problem-name").innerText = problem.name;
        document.querySelector("#problem-description").innerText = problem.description;
    });
    
}());


