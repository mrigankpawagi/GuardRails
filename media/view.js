(function () {
    window.addEventListener('message', event => {

        const command = event.data.command;
        const message = event.data.data; // The JSON data

        switch (command) {
            case 'data':
                build(JSON.parse(message));
                break;
        }
    });
})();

function build(data) {
    console.log(data);
    data.mutant_count = data.mutation_config === 1 ? data.mutant_count : 0;
    document.querySelector('#main-data').innerHTML = makeTable([
        { name: 'Suggestions produced by Copilot', value: data.total_suggestions },
        { name: 'Syntactically correct suggestions', value: `${data.syntactic_suggestions}/${data.total_suggestions}`},
        { name: 'Mutants produced', value: data.mutation_config === 1 ?  data.mutant_count : 'Option not selected' },
    ]);
    document.querySelector('#results-data').innerHTML = makeTable([
        { name: 'Suggestions surviving fuzz-testing*', value: `${data.fuzz_survivors}/${data.total_suggestions + data.mutant_count}`  },
        { name: 'Suggestions passing doctests**', value: `${data.doctest_survivors.length}/${data.total_suggestions + data.mutant_count}` }
    ]);
    document.querySelector('#doctests').innerHTML = makeTable(data.FAULTS.map(fault => {
        var mutant = false;
        var catches = data.reports.map(report => {
            if(report.fault === fault){
                mutant = report.mutant;
                return `<span>${report.catch}</span>`;
            }
        }).join('');

        return { name: ">>> " + fault, value: catches + (mutant ? `<span>from mutant</span>` : '') };
    }));
    var differenceClassesTable = [];
    Object.keys(data.difference_classes).map(cls => {
        var doctests = data.difference_classes[cls].sort((a, b) => a.length - b.length).slice(0, 2);
        doctests.map(doctest => {
            differenceClassesTable.push({ name: ">>> " + doctest, value: cls });
        });
    });
    document.querySelector('#diff-doctests').innerHTML += makeTable(differenceClassesTable);
    var equivalenceClasses = {};
    data.doctest_survivors.forEach((suggestion, i) => {
        var cls = data.equivalence_classes[i + ""];
        if(!equivalenceClasses[cls]){
            equivalenceClasses[cls] = [];
        }
        equivalenceClasses[cls].push(suggestion);
    });
    Object.keys(equivalenceClasses).map(cls => {
        var returnString = "<h4>Equivalence Class " + cls + "</h4>";
        equivalenceClasses[cls].map(suggestion => {
            returnString += (suggestion.mutant ? "<span>Mutant</span>" : "") + "<pre>" + suggestion.suggestion + "</pre>";
        });
        document.querySelector('#all-suggestions').innerHTML += returnString;
    });
}

function makeTable(data) {
    return data.map(row => `<tr><td>${row.name}</td><td>${row.value}</td></tr>`).join('');
}
