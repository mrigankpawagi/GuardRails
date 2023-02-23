// This script will be run within the webview

(function () {

    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.type) {
            case 'start':
                document.querySelector("main").style.display = "block";
                populate(data.value);
                break;
            case 'update':
                console.log("LOL", data.value);
                populate(data.value);
                break;
        }
    });


    document.querySelector("#runVisible").addEventListener("click", function () {

        vscode.postMessage({
            type: 'run',
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
        document.querySelector("#result").innerHTML = `${countCorrect} out ${data.length} test cases passed.`;
        if (countCorrect === data.length) {
            document.querySelector("#result").classList.add("correct");
        }
    });
    
}