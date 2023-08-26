# GuardRails
VSCode extension to help developers set up guardrails around their functions, by helping them disambiguate purpose statements. 

- The VSCode extension is available on the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=MrigankPawagi.guardrails).
- A dataset on the performance of GuardRails in comparison with Copilot Chat is available [here](https://docs.google.com/spreadsheets/d/e/2PACX-1vRwmXlP8V6gbXtB1oQ5IUXfbRjW3eoCYKcbm-zN4uXphd_AK4Wj0CZzVmeXW4XvF2_scszdCD89CFpV/pubhtml?gid=0&single=true).  

## Requirements

1. Python

__Note:__
GuardRails is fully tested only on Windows and currently provides experimental support for Linux.

### Installing Python Dependencies for trimming and mutations

```bash
$ python -m pip install hypothesis hypothesis[cli] hypothesis[ghostwriter] black
$ python -m pip install git+https://github.com/mrigankpawagi/mutpy.git#egg=mutpy
$ python -m pip install func-timeout
```

## Features

1. Copilot suggestion trimmer (for Python)
    - `Control + Shift + /` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions and if the function arguments have type hinting.

2. Copilot suggestion mutator-trimmer (for Python)
    - `Control + Shift + ;` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions or mutants and if the function arguments have type hinting.
