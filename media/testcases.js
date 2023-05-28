// This script will be run within the webview

(function () {

    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.type) {
            case 'start':
                if(data.current){
                    document.querySelector("main").style.display = "block";
                    document.querySelector("#pastProblemWarning").style.display = "none";
                    populate(data.value);
                    if(data.environment){
                        if(data.environment.toLowerCase() === "python"){
                            document.querySelector("#language").value = "python";
                            document.querySelector("#language").disabled = true;
                        }
                        if(data.environment.toLowerCase() === "c"){
                            document.querySelector("#language").value = "c";
                            document.querySelector("#language").disabled = true;
                        }
                    }
                }
                else{
                    document.querySelector("main").style.display = "none";
                    document.querySelector("#pastProblemWarning").style.display = "block";
                }
                break;
            case 'update':
                populate(data.value);
                break;
            case 'updateEvaluation':
                document.querySelector("#resultEvalution").innerHTML = `${data.value.passed} out of ${data.value.total} test cases passed.`;
                document.querySelector("#resultEvalution").classList.remove("correct");
                if (data.value.passed === data.value.total) {
                    document.querySelector("#resultEvalution").classList.add("correct");
                }
                break;
        }
    });


    document.querySelector("#runVisible").addEventListener("click", function () {

        vscode.postMessage({
            type: 'run',
            value: document.querySelector("#language").value,
        });
    });

    document.querySelector("#evaluate").addEventListener("click", function () {

        vscode.postMessage({
            type: 'evaluate',
            value: document.querySelector("#language").value,
        });
    });

}());

function populate(data) {

    const headerRow = `<tr>
                            <td><b>Input</b></td>
                            <td><b>Expected Output</b></td>
                            <td><b>Output</b></td>
                            <td><b>Status</b></td>
                        </tr>`;

    document.querySelector("table").innerHTML = headerRow;
    var countCorrect = 0;
    data.forEach(e => {
        document.querySelector("table").innerHTML += `
            <tr>
                <td>${e.input}</td>
                <td>${e.correctOutput}</td>
                <td>${e.output}</td>
                <td class="${e.status === "Correct" ? "correct" : "incorrect"}">${e.status}</td>
            </tr>
        `;
        countCorrect += e.status === "Correct" ? 1 : 0;
        document.querySelector("#result").innerHTML = `${countCorrect} out of ${data.length} test cases passed.`;
        document.querySelector("#result").classList.remove("correct");
        if (countCorrect === data.length) {
            document.querySelector("#result").classList.add("correct");
        }
    });
    
}