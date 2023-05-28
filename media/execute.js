// This script will be run within the webview
(function () {
  const vscode = acquireVsCodeApi();

  window.addEventListener("message", (event) => {
    const data = event.data;
    switch (data.type) {
      case "start":
        document.querySelector("main").style.display = "block";
        if (data.environment) {
          if (data.environment.toLowerCase() === "python") {
            document.querySelector("#language").value = "python";
            document.querySelector("#language").disabled = true;
          }
          if (data.environment.toLowerCase() === "c") {
            document.querySelector("#language").value = "c";
            document.querySelector("#language").disabled = true;
          }
        }
        break;
      case "output":
        document.querySelector("#output").value = data.value;
        break;
    }
  });

  document.querySelector("button").addEventListener("click", function () {
    document.querySelector("#output").value = "";
    vscode.postMessage({
      type: "input",
      language: document.querySelector("#language").value,
      value: document.querySelector("#input").value,
    });
  });
})();
